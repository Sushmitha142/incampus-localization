
const getScore = (queryTokens, targetTokens) => {
    if (targetTokens.length === 0) return 0;
    const targetSet = new Set(targetTokens);
    const intersection = queryTokens.filter(token => targetSet.has(token)).length;
    const union = new Set([...queryTokens, ...targetTokens]).size;
    return intersection / union;
};

// Main helper function for simplified fuzzy matching and keyword extraction
const findBestMatch = (query, targetList, threshold = 0.45) => {
    // 1. Sanitize the query
    const rawQuery = query.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '');
    const queryTokens = rawQuery.split(/\s+/).filter(t => t.length > 0);

    if (queryTokens.length === 0) return null;

    let bestMatch = null;
    let maxScore = 0;

    // --- REVISED: Prioritize single-word character similarity for short queries ---
    if (queryTokens.length === 1) {
        const singleQueryToken = queryTokens[0];

        for (const target of targetList) {
            const normalizedTarget = target.toLowerCase().replace(/[^a-z0-9]/g, '');

            if (singleQueryToken.length >= 3 && normalizedTarget.length >= 3) {
                // Levenshtein distance calculation to be more precise on single-letter errors (like 'cdd' -> 'ccd')
                let dp = Array(singleQueryToken.length + 1).fill(0).map(() => Array(normalizedTarget.length + 1).fill(0));
                for (let i = 0; i <= singleQueryToken.length; i++) dp[i][0] = i;
                for (let j = 0; j <= normalizedTarget.length; j++) dp[0][j] = j;

                for (let i = 1; i <= singleQueryToken.length; i++) {
                    for (let j = 1; j <= normalizedTarget.length; j++) {
                        const cost = (singleQueryToken[i - 1] === normalizedTarget[j - 1]) ? 0 : 1;
                        dp[i][j] = Math.min(
                            dp[i - 1][j] + 1,        // Deletion
                            dp[i][j - 1] + 1,        // Insertion
                            dp[i - 1][j - 1] + cost  // Substitution
                        );
                    }
                }
                const distance = dp[singleQueryToken.length][normalizedTarget.length];
                const similarity = 1 - distance / Math.max(singleQueryToken.length, normalizedTarget.length);

                // If similarity is high (allowing for one or two character changes/misspellings)
                if (similarity >= 0.6) { // 0.6 means 60% match, good for 3-5 letter words with 1 error
                    return target;
                }
            }
        }
    }
    // --------------------------------------------------------------------------

    // 2. Fallback to Multi-Word/Token Matching (Original Logic)
    for (const target of targetList) {
        const normalizedTarget = target.toLowerCase();

        const targetNameTokens = normalizedTarget
            .replace(/ block| court| cell| lab| gate/g, "") // remove generic terms
            .replace(/[^a-z0-9\s]/g, '')
            .split(/\s+/).filter(t => t.length > 0);

        targetNameTokens.push(normalizedTarget.replace(/\s/g, '_'));

        const isSubstringMatch = rawQuery.includes(normalizedTarget.replace(/\s/g, ''));

        let score = getScore(queryTokens, targetNameTokens);

        if (isSubstringMatch) {
            score += 0.15;
        }

        if (score > maxScore) {
            maxScore = score;
            bestMatch = target;
        }
    }

    // 3. Apply Threshold and Final Fallback
    if (maxScore >= threshold) {
        return bestMatch;
    }

    // Final fallback for very weak but meaningful token matches (maxScore > 0.3)
    if (maxScore > 0.3) {
        return bestMatch;
    }

    return null;
};


class ActionProvider {
    constructor(createChatBotMessage, setStateFunc, createClientMessage, stateRef) {
        this.createChatBotMessage = createChatBotMessage;
        this.setState = setStateFunc;
        this.createClientMessage = createClientMessage;
        this.stateRef = stateRef; // Note: stateRef is for advanced use, simpler setState used here.
    }

    // --- 1. Data Structure for Rooms ---
    // The complete map of Block -> Floor -> Room details
    campusMap = {
        // Note: The floor names here match the buttons in widgets.js
        "a block": {
            " a block Ground Floor": [
                { id: "A-G-01", name: "Placement Room", direction: "From the main entrance, take 1st left. It's the first room." },
                { id: "A-G-WR", name: "Washroom", direction: "Located in 1st Floor." },
                { id: "A-G-SH", name: "Seminar Hall", direction: "From the main entrance, take 1st left." },
                { id: "A-G-WR", name: "Room", direction: "The Room is located on the straingh to the entrance " },
            ],
            "a block 1st Floor": [
                { id: "A-1-01", name: "LH 101", direction: "Turn Right after the stairs." },
                { id: "A-1-02", name: "LH 102", direction: "Turn Right after the stairs." },
                { id: "A-1-03", name: "LH 103", direction: "Turn Right after the stairs." },
                { id: "A-1-04", name: "Student Lounge", direction: "Turn Left after the stairs." },
                { id: "A-1-05", name: "MBA Staff Room", direction: "Turn Left after the stairs.It is in Corner." },
                { id: "A-1-06", name: "Washoom", direction: "Turn Left after the stairs.Beside student Lounge." },
                { id: "A-1-07", name: "Library", direction: "Turn Left after the stairs.Opposite to MBA Staffroom." },
            ],
            "a block 2nd Floor": [
                { id: "A-2-01", name: "LH 201", direction: "Turn right after the stairs." },
                { id: "A-2-02", name: "LH 202", direction: "Turn right after the stairs." },
                { id: "A-2-03", name: "LH 203", direction: "Turn right after the stairs." },
                { id: "A-2-04", name: "LH 204", direction: "Turn right after the stairs." },
                { id: "A-2-05", name: "MCA-201 Reseach Lab", direction: "Turn Left after the stairs." },
                { id: "A-2-WR", name: "Washroom", direction: "Turn left after the stairs, MCA research lab." },
                { id: "A-2-06", name: "MCA Staff Room", direction: "Turn Left after the stairs." },
            ],
            "a block 3rd Floor": [
                { id: "A-3-01", name: "CMR University School of Arch", direction: "Located centrally on the floor." },
                { id: "A-3-02", name: "MCA 301", direction: "Located directly in front of (or below on the sketch) CMR University School of Arch." },
                { id: "A-3-03", name: "MCA 302", direction: "Located near MCA 301." },
                { id: "A-3-04", name: "Empty Room", direction: "Located on the far right side of the floor." },
                { id: "A-3-05", name: "Room (Small Central)", direction: "Located next to MCA 301 and near the central staircase." },
                { id: "A-3-06", name: "Stairs 1 (Central)", direction: "Located on the left side, with access to the central corridor." },
                { id: "A-3-07", name: "Stairs 2 (Lower Left)", direction: "Located below Stairs 1, leading left." },
                { id: "A-3-08", name: "Room (Left)", direction: "Located on the far left side, next to the stairs/Studio Rooms." },
                { id: "A-3-09", name: "Studio Room (Top Left)", direction: "Located above the main Stairs area on the left." },
                { id: "A-3-10", name: "Studio Room (Middle Left)", direction: "Located next to the central stairs on the left." },
                { id: "A-3-11", name: "Studio Room (Bottom Left)", direction: "Located below the central stairs on the left." }
            ],
            "a block 4th Floor": [
                { id: "A-4-01", name: "Material Library", direction: "Located centrally on the floor." },
                { id: "A-4-02", name: "Gents Washroom", direction: "Located next to the Material Library on the right." },
                { id: "A-4-03", name: "Ladies Washroom", direction: "Located next to the Gents Washroom." },
                { id: "A-4-04", name: "Work Shop", direction: "Located on the far right side of the floor, past the washrooms." },
                { id: "A-4-05", name: "Auditorium", direction: "Located below the Material Library." },
                { id: "A-4-06", name: "Stairs 1 (Top Left)", direction: "Located on the far upper-left side." },
                { id: "A-4-07", name: "Stairs 2 (Central Left)", direction: "Located on the central-left side, below Stairs 1." },
                { id: "A-4-08", name: "Stairs 3 (Lower Left)", direction: "Located below Stairs 2, leading left." },
                { id: "A-4-09", name: "Room (Top Left)", direction: "Located next to Stairs 1." },
                { id: "A-4-10", name: "Studio Room", direction: "Located below Room (Top Left)." }
            ],
            "a block 5th Floor": [
                { id: "A-5-01", name: "Empty Area", direction: "Located centrally on the floor." },
                { id: "A-5-02", name: "Stair Case", direction: "Located on the left side of the floor." }
            ]
        },
        // Add data for B, C, D, E, Canteen in a similar structured format
        // Example B Block:
        "b block": {
            "b block basement": [
                { id: "B-B-01", name: "Makerspace", direction: "From the main entrance, Take down staris." },
                { id: "B-B-02", name: "Basic Electrical Lab", direction: "From the main entrance, Take down staris." },
                { id: "B-B-03", name: "Examination Section", direction: "From the main entrance, Take down staris and turn left." },
                { id: "B-B-04", name: "CAED Lab", direction: "From the main entrance, Take down staris and turn left." },
                { id: "B-B-05", name: "CPL Lab", direction: "From the main entrance, Take down staris and turn left." },

            ],
            "b block Ground Floor": [
                { id: "B-G-01", name: "Reception", direction: "From the main entrance, go straight." },
                { id: "B-G-02", name: "Placement Cell", direction: "From the main entrance, go straight beside reception." },
                { id: "B-G-03", name: "Board Room", direction: "From the main entrance, go straight." },
                { id: "B-G-04", name: "Administrative Office", direction: "From the main entrance, go straight and turn right." },
                { id: "B-G-05", name: "Principal's Chamber", direction: "From the main entrance, go straight and turn right." },
                { id: "B-G-01", name: "Vive Principal's Chamber", direction: "From the main entrance, go straight and turn right." },
                { id: "B-G-01", name: "Chairman's Chamber", direction: "From the main entrance, go straight and turn right." },
                { id: "B-G-01", name: "CEO's Chamber", direction: "From the main entrance, go straight and turn right." },
            ],
            "b block 1st Floor": [
                { id: "B-1-01", name: "BS 101", direction: "After exiting the elevator/stairs, turn right. It's the first room." },
                { id: "B-1-02", name: "BS 102", direction: "After exiting the elevator/stairs, turn right. It's the second room." },
                { id: "B-1-03", name: "BS 103", direction: "After exiting the elevator/stairs, turn right. It's the third room." },
                { id: "B-1-04", name: "BS 104", direction: "After exiting the elevator/stairs, turn right. It is opposite to BS 103." },
                { id: "B-1-05", name: "BS 105", direction: "After exiting the elevator/stairs, turn right. It is opposite to BS 102." },
                { id: "B-1-06", name: "BS 106", direction: "After exiting the elevator/stairs, turn right. It is opposite to BS 101." },
            ],
            "b block 2nd Floor": [
                { id: "B-2-LIB", name: "Central Library", direction: "The central library is on left side of 2nd floor." },
                { id: "B-2-PLAB", name: "Physics Lab", direction: "The Physics lab is on the right side of 2nd floor." },
                { id: "B-2-CLAB", name: "Chemistry Lab", direction: "The Chemistry lab is on the right side of 2nd floor opposite the Physics Lab." },
                { id: "B-2-WR", name: "Washroom", direction: "Located beside library." },
            ],
            "b block 3rd Floor": [
                { id: "B-3-AUDI", name: "Auditorium-DWANI", direction: "The auditorium is on the left side of 3rd floor." },
                { id: "B-3-01", name: "BS 301", direction: "After exiting the elevator/stairs, turn right. It's the first room." },
                { id: "B-3-02", name: "BS 302", direction: "After exiting the elevator/stairs, turn right. It's the second room." },
                { id: "B-3-03", name: "BS 303", direction: "After exiting the elevator/stairs, turn right. It's the third room." },
                { id: "B-3-04", name: "BS 304", direction: "After exiting the elevator/stairs, turn right. It is opposite to BS 303." },
                { id: "B-3-05", name: "BS 305", direction: "After exiting the elevator/stairs, turn right. It is opposite to BS 302." },
                { id: "B-3-06", name: "BS 306", direction: "After exiting the elevator/stairs, turn right. It is opposite to BS 301." },
                { id: "B-3-WR", name: "Washroom", direction: "Located beside Auditorium." },
            ],
            "b block 4th Floor": [
                { id: "B-4-AUDI", name: "Auditorium", direction: "The auditorium is on the 4th floor. Take the elevator/stairs up." },
                { id: "B-4-SL", name: "Student Lounge", direction: "take the elevator/stairs to the 4th floor." },
                { id: "B-4-01", name: "BS 401", direction: "After exiting the elevator/stairs, turn right. It's the first room." },
                { id: "B-4-02", name: "BS 402", direction: "After exiting the elevator/stairs, turn right. It's the second room." },
                { id: "B-4-03", name: "BS 403", direction: "After exiting the elevator/stairs, turn right. It's the third room." },
                { id: "B-4-04", name: "BS 404", direction: "After exiting the elevator/stairs, turn right. It's the fourth room." },
                { id: "B-4-05", name: "BS 405", direction: "After exiting the elevator/stairs, turn right. It's the fifth room." },
                { id: "B-4-06", name: "Basic Science Staff Room", direction: "After exiting the elevator/stairs, turn right. It is opposite to BS 403." },
                { id: "B-2-WR", name: "Washroom", direction: "Located beside Auditorium." },

            ],
        },
        "c block": {
            "c block Ground Floor": [
                { id: "C-G-01", name: "TYL Staffroom", direction: "From main entrance take right." },
                { id: "C-G-02", name: "Math Lab", direction: "From second entrance take left." },
            ],
            "c block 1st Floor": [
                { id: "C-1-01", name: "Student Lounge", direction: "From the right-side staircase, turn left; it’s the first room on your right." },
                { id: "C-1-02", name: "Dept Library", direction: "Next to the Student Lounge." },
                { id: "C-1-03", name: "LH-101", direction: "Beside the Dept Library." },
                { id: "C-1-04", name: "LH-102", direction: "Next to LH-101, on the same corridor." },
                { id: "C-1-05", name: "LH-103", direction: "Next to LH-102, continue straight." },
                { id: "C-1-06", name: "LH-104", direction: "Next to LH-103, near the middle staircase." },
                { id: "C-1-07", name: "LH-105", direction: "Continue past the restrooms after the middle staircase." },
                { id: "C-1-08", name: "AEC/EC Lab", direction: "After LH-105, on the left corridor." },
                { id: "C-1-09", name: "LH-106", direction: "At the end of the left corridor, next to AEC/EC Lab." },
                { id: "C-1-10", name: "PSS/MC Lab", direction: "Beside LD/CELD Lab, near LH-106." },
                { id: "C-1-11", name: "LD/CELD Lab", direction: "Next to the PSS/MC Lab, opposite the lift area." },
                { id: "C-1-12", name: "DC/WTN Lab (Machines Lab)", direction: "Next to LD/CELD Lab, across the middle staircase." },
                { id: "C-1-13", name: "CSM/CS Lab", direction: "Near the left staircase, opposite the server room." },
                { id: "C-1-14", name: "Server Room", direction: "Near the left staircase beside the lift, next to store rooms." },
                { id: "C-1-15", name: "HOD Office and Faculty Hall", direction: "Beside restrooms, on the right corridor near LH-105." },
                { id: "C-1-16", name: "Electrical Store Rooms 1, 2 & 3", direction: "Next to the server room, near the left staircase." },
                { id: "C-1-17", name: "Washroom", direction: "Two locations — near LH-105 and beside the HOD Office." }
            ],
            "c block 2nd Floor": [
                { id: "C-2-01", name: "Dept Library", direction: "From the right-side (Staff) staircase, it's the first room on the right." },
                { id: "C-2-02", name: "LH-201", direction: "Next to the Dept Library." },
                { id: "C-2-03", name: "LH-202", direction: "Next to LH-201, continue straight." },
                { id: "C-2-04", name: "LH-203", direction: "Next to LH-202." },
                { id: "C-2-05", name: "LH-204", direction: "Next to LH-203." },
                { id: "C-2-06", name: "Staff Toilet", direction: "Located on the main corridor, between LH-205 and the Staff Room." },
                { id: "C-2-07", name: "Staff Room", direction: "At the end of the main corridor, past the Staff Toilet and LH-205." },
                { id: "C-2-08", name: "LH-205", direction: "On the main corridor, between LH-204 and the Staff Toilet." },
                { id: "C-2-09", name: "LH-206", direction: "On the far left corner of the floor, past the Washroom." },
                { id: "C-2-10", name: "Washroom", direction: "Located on the far left side, next to LH-206." },
                { id: "C-2-11", name: "LH-207", direction: "On the top-left corridor, past LH-206 (if entering from the left side)." },
                { id: "C-2-12", name: "L-208", direction: "On the left corridor, below LH-207." },
                { id: "C-2-13", name: "L-209", direction: "On the bottom-left corridor, below L-208." },
                { id: "C-2-14", name: "L-210", direction: "In the bottom-left corner, next to the Lift." },
                { id: "C-2-15", name: "L-211", direction: "Next to L-210, on the bottom corridor." },
                { id: "C-2-16", name: "L-212", direction: "On the central-left side, next to L-211 and across from the Stair Case (Left)." },
                { id: "C-2-17", name: "L-213", direction: "On the central-left side, next to L-212 and opposite the B.E. Lecture Halls (LH-201 to LH-204)." },
                { id: "C-2-18", name: "Stair Case (Left)", direction: "Located near L-212, L-213, and the Lift area." },
                { id: "C-2-19", name: "Stair Case (Right)", direction: "Located near Dept Library and LH-201." },
            ],
            "c block 3rd Floor": [
                { id: "C-3-01", name: "Student Lounge", direction: "From the right-side staircase, turn left; it's the first room on your right, before the Dept Library." },
                { id: "C-3-02", name: "Dept Library", direction: "Next to the Student Lounge." },
                { id: "C-3-03", name: "LH-301", direction: "Beside the Dept Library." },
                { id: "C-3-04", name: "LH-302", direction: "Next to LH-301, on the same corridor." },
                { id: "C-3-05", name: "LH-303", direction: "Next to LH-302, continue straight." },
                { id: "C-3-06", name: "LH-304", direction: "Next to LH-303, near the middle staircase." },
                { id: "C-3-07", name: "Rest Rooms (Center)", direction: "Located on the main corridor, between LH-305 and the HOD Office/Faculty Hall." },
                { id: "C-3-08", name: "HOD Office and Faculty Hall", direction: "At the end of the main corridor, past the central Rest Rooms and LH-305." },
                { id: "C-3-09", name: "LH-305", direction: "On the main corridor, between LH-304 and the central Rest Rooms." },
                { id: "C-3-10", name: "Rest Rooms (Left)", direction: "Located on the upper-left corridor, between LH-306 and LH-305." },
                { id: "C-3-11", name: "LH-306", direction: "On the top-left corridor, past the left Rest Rooms." },
                { id: "C-3-12", name: "M.Tech L-307", direction: "On the far upper-left side, below LH-306." },
                { id: "C-3-13", name: "M.Tech L-308", direction: "Below M.Tech L-307." },
                { id: "C-3-14", name: "L-303 (VLSI / MP Lab)", direction: "Below M.Tech L-308." },
                { id: "C-3-15", name: "L-302 (HDL / DSP Lab)", direction: "Below L-303, near the Lift." },
                { id: "C-3-16", name: "L-301 (Comm. & Adv. Comm. Lab)", direction: "In the bottom-left corner, below L-302 and the Stair Case/Lift area." },
                { id: "C-3-17", name: "L-304 (PE Lab)", direction: "Next to L-301, on the bottom corridor." },
                { id: "C-3-18", name: "Stores", direction: "Next to L-304, across the bottom corridor." },
                { id: "C-3-19", name: "L-305 (Project Lab)", direction: "Above the Stores, near the middle staircase area." },
                { id: "C-3-20", name: "L-306 (AEC Lab)", direction: "Above L-305." },
                { id: "C-3-21", name: "L-307 (DE / MC Lab)", direction: "Above L-306, opposite the middle staircase." },
                { id: "C-3-22", name: "Stair Case (Left)", direction: "Located near L-301, L-302, and the Lift area." },
                { id: "C-3-23", name: "Lift", direction: "In the bottom-left corner, next to the Stair Case." }

            ],
            "c block 4th Floor": [
                { id: "C-4-01", name: "Student Lounge", direction: "From the right-side staircase, turn left; it's the first room on your right, before the Dept Library." },
                { id: "C-4-02", name: "Dept Library", direction: "Next to the Student Lounge." },
                { id: "C-4-03", name: "LH-401", direction: "Beside the Dept Library." },
                { id: "C-4-04", name: "LH-402", direction: "Next to LH-401, on the same corridor." },
                { id: "C-4-05", name: "LH-403", direction: "Next to LH-402, continue straight." },
                { id: "C-4-06", name: "LH-404", direction: "Next to LH-403." },
                { id: "C-4-07", name: "Faculty Hall", direction: "At the end of the main corridor, past the Faculty Rest Room." },
                { id: "C-4-08", name: "Faclty Res. Room", direction: "Next to the Faculty Hall and LH-405." },
                { id: "C-4-09", name: "LH-405", direction: "On the top corridor, next to the Faculty Rest Room." },
                { id: "C-4-10", name: "Rest Room (Top)", direction: "Next to LH-406, across the upper corridor." },
                { id: "C-4-11", name: "LH-406", direction: "On the top-left corridor, past the up/down staircase, next to the Rest Room." },
                { id: "C-4-12", name: "LH-407A", direction: "On the far top-left side, above LH-407B." },
                { id: "C-4-13", name: "LH-407B", direction: "Below LH-407A." },
                { id: "C-4-14", name: "LAB-408", direction: "Below LH-407B." },
                { id: "C-4-15", name: "LAB-409", direction: "Below LAB-408." },
                { id: "C-4-16", name: "LAB-410", direction: "In the bottom-left corner, below LAB-409 and next to the up/down stairs." },
                { id: "C-4-17", name: "LAB-411", direction: "Next to LAB-410, on the bottom corridor." },
                { id: "C-4-18", name: "LAB-412A", direction: "Above LAB-411, on the central-left side." },
                { id: "C-4-19", name: "LAB-412B", direction: "Above LAB-412A." },
                { id: "C-4-20", name: "LAB-413", direction: "Above LAB-412B, opposite the LH-404/405 area." },
                { id: "C-4-21", name: "Stair Case (Right)", direction: "Located in the far right corner." },
                { id: "C-4-22", name: "Stairs (Central)", direction: "Mid-floor, near LH-405 and LAB-413 (Up/Down)." },
                { id: "C-4-23", name: "Stairs (Left)", direction: "On the far left side, near LAB-410 (Up/Down)." }
            ],
            "c block 5th Floor": [
                { id: "C-5-01", name: "Dept Library", direction: "From the right-side staircase, it's the first room on the right, opposite LH-501." },
                { id: "C-5-02", name: "LH-501", direction: "Next to the Dept Library on the main corridor." },
                { id: "C-5-03", name: "LH-502", direction: "Next to LH-501, continue straight." },
                { id: "C-5-04", name: "LH-503", direction: "Next to LH-502." },
                { id: "C-5-05", name: "LH-504", direction: "Next to LH-503." },
                { id: "C-5-06", name: "Staff Room", direction: "Located at the end of the main corridor near the staircase, opposite LH-501/502." },
                { id: "C-5-07", name: "Staff Toilet", direction: "Located on the upper corridor, between the Staff Room and M.Tech CSE Lab." },
                { id: "C-5-08", name: "M.Tech CSE Lab", direction: "On the upper corridor, between Staff Toilet and M.Tech CSE LH." },
                { id: "C-5-09", name: "M.Tech CSE LH", direction: "On the upper corridor, between M.Tech CSE Lab and LH-505." },
                { id: "C-5-10", name: "LH-505", direction: "Next to M.Tech CSE LH, near the Washroom." },
                { id: "C-5-11", name: "Washroom", direction: "Located on the far upper-left side, next to LH-505." },
                { id: "C-5-12", name: "LH-506", direction: "On the far top-left side, above L-503." },
                { id: "C-5-13", name: "R&D Lab / CoE MI & BD", direction: "Below LH-505, on the central-upper side." },
                { id: "C-5-14", name: "L-506", direction: "Below R&D Lab, opposite LH-504." },
                { id: "C-5-15", name: "L-505", direction: "Below L-506." },
                { id: "C-5-16", name: "CoE Cybersecurity", direction: "Below L-505." },
                { id: "C-5-17", name: "L-504", direction: "Below CoE Cybersecurity." },
                { id: "C-5-18", name: "L-501 (Left)", direction: "In the bottom-left corner, below L-502 and next to the Lift/Stair Case." },
                { id: "C-5-19", name: "L-502", direction: "Above L-501, near the Stair Case/Lift area." },
                { id: "C-5-20", name: "L-503", direction: "Above L-502, near LH-506." },
                { id: "C-5-21", name: "Stair Case (Left)", direction: "Located in the bottom-left corner, next to the Lift." },
                { id: "C-5-22", name: "Lift", direction: "In the bottom-left corner, next to the Stair Case." },
                { id: "C-5-23", name: "Stair Case (Right)", direction: "Located in the far right corner." }
            ],
        },
        "d block": {
            "d block Ground Floor": [
                { id: "dl001", name: "DL-001", direction: "Enter D block ; the DL-001 lab is right side , 1st lab." },
                { id: "dl002", name: "DL-002", direction: "Enter D block ; the DL-002 lab is right side , 2nd lab." },
                { id: "dl003", name: "DL-003", direction: "Enter D block ; the DL-003 lab is right side , 3rd lab." },
                { id: "dl004", name: "DL-004", direction: "Enter D block ; the DL-004 lab is right side , 4th lab." },
                { id: "dl005", name: "DL-005", direction: "Enter D block ; the DL-005 lab is right side , opposite to DL004." },
                { id: "meeting", name: "Meeting Room", direction: "Enter D block ; the Meeting Room is left side , opposite to Seminar Hall." },
                { id: "avhall", name: "AV Hall", direction: "Enter D block ; the AV Hall is left side , opposite to Meeting Room." },
                { id: "stairs", name: "Stairs", direction: "Enter D block ; the Stairs are in the center." },
                { id: "washroom", name: "Washroom", direction: "Enter D block ; the washroom is in the left side" },
            ],
            "d block 1st Floor": [
                { id: "D-1-01", name: "AIML Staff Room", direction: "Take the first left after the stairs." },
                { id: "D-1-02", name: "Meeting Room", direction: "Turn Right after the stairs. Opposit to AV Hall." },
                { id: "D-1-03", name: "AV Hall", direction: "Turn right after the stairs." },
                { id: "D-1-04", name: "Washroom", direction: "Turn right after the stairs,Located beside AV Hall." },
            ],
            "d block 2nd Floor": [
                { id: "D-2-00", name: "Innovation & Entrepreneurship Cell", direction: "Turn left after the stairs, located at the corner." },
                { id: "D-2-01", name: "ME 201", direction: "Turn left after the stairs, located at the corner." },
                { id: "D-2-02", name: "ME 202", direction: "Turn left after the stairs, beside room 201." },
                { id: "D-2-03", name: "ME 203", direction: "Go straight after stairs, Next to ME 202." },
                { id: "D-2-04", name: "ME 204", direction: "Go straight after stairs,Next to ME 203." },
                { id: "D-2-05", name: "ME 205", direction: "Turn right after the stairs,Next to ME 204." },
                { id: "D-2-06", name: "AV Hall", direction: "Turn right after the stairs, opposite to ME 205." },
                { id: "D-2-WR", name: "Washroom", direction: "Turn right after the stairs,Located beside AV Hall." },
            ],
            "d block 3rd Floor": [
                { id: "D-3-01", name: "AIDS Staff Room", direction: "Turn left after the stairs." },
                { id: "D-3-02", name: "CV 301", direction: "Go straight after the stairs." },
                { id: "D-3-03", name: "CV 302", direction: "Turn right after the stairs, beside room 301." },
                { id: "D-3-04", name: "CV 303", direction: "Turn right after the stairs, Next to CV 302." },
                { id: "D-2-06", name: "AV Hall", direction: "Turn right after the stairs, opposite to CV 302." },
                { id: "D-3-WR", name: "Washroom", direction: "Turn right after the stairs,Located beside AV Hall." },
            ],
            "d block 4th Floor": [
                { id: "D-4-01", name: "Image & Video Analytics", direction: "Turn left after the stairs." },
                { id: "D-4-02", name: "CV 400", direction: "Turn left after the stairs." },
                { id: "D-4-03", name: "CV 401", direction: "Turn left after the stairs, beside room 400." },
                { id: "D-4-04", name: "CV 402", direction: "Go straight after the stairs, Next to CV 401." },
                { id: "D-4-05", name: "CV 403", direction: "Turn right after the stairs, Next to CV 402." },
                { id: "D-4-06", name: "CV 404", direction: "Turn right after the stairs, Next to CV 403." },
                { id: "D-4-06", name: "AV Hall", direction: "Turn right after the stairs, opposite to CV 403." },
                { id: "D-4-WR", name: "Washroom", direction: "Turn right after the stairs,Located beside AV Hall." },
            ],
        },
        "e block": {
            "e block Ground Floor": [
                { id: "E-G-HOSTEL", name: "Hostel Entry", direction: "The main entry is located here." },
            ],
            "e block 1st Floor": [
                { id: "E-1-01", name: "Tutorial Room", direction: "First room on the right." },
            ],
        },
        "canteen": {
            "canteen Ground Floor": [
                { id: "C-G-01", name: "Cafe Corner", direction: "The Cafe corner is in entrance of the canteen." },
                { id: "C-T-COURT", name: "TT Court", direction: "The TT court is below the canteen area." },
                { id: "C-B-COURT", name: "Basketball Court", direction: "The basketball court is opposite to E Block." },
                { id: "C-V-COURT", name: "Volleyball Court", direction: "The volleyball court is next to the basketball court." },
                { id: "C-TURF", name: "Turf Ground", direction: "The turf ground is beside the canteen." },
                { id: "C-GYM", name: "Gym", direction: "The gym is beside the TT court." },
                { id: "C-WR", name: "Washroom", direction: "Located near the below canteen." },
                { id: "C-PE", name: "PE Room", direction: "The Physical Education Staff Room is located beside TT Court." },
            ],
            "canteen 1st Floor": [
                { id: "C-1-01", name: "Canteen", direction: "The canteen is on the 1st floor.Enjoy your meal!" },
            ],
            "canteen 2nd Floor": [
                { id: "C-2-01", name: "Chikkin", direction: "The seating area is on the 2nd floor." },
            ],
        }
    };

    // --- 2. Main Location Handlers from your original code ---
    locationDirections = {
        // Your original directions for main campus locations
        "hi": "Hello! How can I assist you today?",
        "hello": "Hello! How can I assist you today?",
        "main gate": "You are at the Main Gate. Go straight to reach the main campus area.",
        "parking": "From the Main Gate, go straight — you’ll find parking spaces on both sides.",
        "a block": "From the Main Gate, go straight and take the first left near the parking area. A Block is just beside CCD.",
        "b block": "From the Main Gate, go straight and take the first left near parking. B Block is opposite to A Block.",
        "c block": "From the Main Gate, go straight and take left. C Block is beside B Block.",
        "d block": "From the Main Gate, go straight and move a bit to the right of C Block — you’ll find D Block there, opposite to canteen.",
        "e block": "From the Main Gate, go straight, keep moving right past D Block — you’ll reach E Block and the Hostel area.",
        "accounts section": "The Accounts section is between B Block and C Block.",
        "canteen": "From the Main Gate, go straight and take right. The canteen is opposite D Block.",
        "turf": "From the Main Gate, go straight — the turf ground is beside canteen.",
        "ground": "From the Main Gate, go straight — the ground is beside canteen.",
        "gym": "From the Main Gate, go straight to the canteen. The gym is located below canteen, beside the TT court.",
        "auditorium": "From the Main Gate, take left towards B Block. The auditorium is on the 3rd floor of B Block.",
        "library": "From the Main Gate, take left towards B Block. The library is on the 2nd floor of B Block.",
        "ccd": "From the Main Gate, go straight and take left near parking. CCD is located between A Block and B Block.",
        "cdx": "From the Main Gate, go straight and take left near parking. CDX is also between A Block and B Block.",
        "hostel": "From the Main Gate, go straight and continue right past D Block. The hostel is inside E Block.",
        "basketball court": "From the Main Gate, go straight and keep right past D Block — the basketball court is opposite to E Block.",
        "bb court": "From the Main Gate, go straight and keep right past D Block — the basketball court is opposite to E Block.",
        "volleyball court": "From the Main Gate, go straight and keep right past D Block — the volleyball court is next to the basketball court.",
        "tt court": "From the Main Gate, go straight. The TT court is below canteen.",
        "table tennis court": "From the Main Gate, go straight. The TT court is below canteen.",
        "aiml staffroom": "From the Main Gate, go to D Block. The AIML staffroom is on the 1st floor of D Block.",
        "aiml hod cabin": "From the Main Gate, go to D Block. The AIML HOD cabin is on the 1st floor of D Block inside staffroom.",
        "hod cabin": "From the Main Gate, go to D Block. The AIML HOD cabin is on the 1st floor of D Block inside staffroom.",
        "hod aiml": "From the Main Gate, go to D Block. The AIML HOD cabin is on the 1st floor of D Block inside staffroom.",
        "aids staffroom": "From the Main Gate, go to D Block. The AIDS staffroom is on the 3rd floor of D Block.",
        "thank you": "You're welcome! If you have any more questions, feel free to ask.",
        "thank u": "You're welcome! If you have any more questions, feel free to ask.",
        "thanks": "You're welcome! If you have any more questions, feel free to ask.",
        "thanks a lot": "You're welcome! If you have any more questions, feel free to ask.",
        "thank you so much": "You're welcome! If you have any more questions, feel free to ask.",
        "tq": "You're welcome! If you have any more questions, feel free to ask.",
    };

    // --- 3. Main Query Handler (Initial Message) ---
    handleQuery = (query) => {
        // --- 🔑 Dynamic Matching Logic ---
        const allKnownLocations = Object.keys(this.locationDirections).concat(Object.keys(this.campusMap));

        // Call the global helper function
        const matchedLocation = findBestMatch(query, allKnownLocations);

        // If a location is matched (e.g., 'aiml hod' or 'dblock')
        if (matchedLocation) {
            // Check if the matched location is a major block that has an indoor map/widget
            const isBlockMatch = Object.keys(this.campusMap).includes(matchedLocation);

            // Fetch direction/answer from the dictionary
            const initialDirection = this.locationDirections[matchedLocation] ||
                `Found **${matchedLocation}**! You can search it on the map for navigation.`;

            const directionMessage = this.createChatBotMessage(initialDirection, { parse: true });

            if (isBlockMatch) {
                // It's a block (A, B, C, D, E, Canteen), so show floor widget

                // 2. Floor selection message with widget
                const floorMessage = this.createChatBotMessage(
                    `Which floor in **${matchedLocation.toUpperCase()}** are you looking for?`,
                    {
                        widget: "floorOptions",
                        payload: { block: matchedLocation }, // Pass the block name to the widget
                        parse: true
                    }
                );

                // Append both messages in order
                this.setState(prev => ({
                    ...prev,
                    messages: [...prev.messages, directionMessage, floorMessage]
                }));

            } else {
                // It's a non-block location (like 'canteen' or 'aiml hod')
                // Only send the direction message
                const message = this.createChatBotMessage(directionMessage.message, { parse: true });
                this.setState(prev => ({
                    ...prev,
                    messages: [...prev.messages, message]
                }));
            }

        } else {
            // No match found or score was too low
            const answer = "Sorry, I couldn't find a good match for that location. Please try searching on the map or using a clearer keyword.";
            const message = this.createChatBotMessage(answer);
            this.setState(prev => ({
                ...prev,
                messages: [...prev.messages, message]
            }));
        }
    };

    // --- 4. Handler for Floor Selection (Step 2) ---
    handleFloorSelect = (floorQuery) => {
        const blockKey = Object.keys(this.campusMap).find(key =>
            floorQuery.toLowerCase().startsWith(key.toLowerCase())
        );

        if (!blockKey) {
            const message = this.createChatBotMessage(`Invalid block selected.`);
            this.updateChatbotState(message);
            return;
        }

        // Find the exact floor key (case-sensitive) inside the block
        const floorKey = Object.keys(this.campusMap[blockKey]).find(floor =>
            floor.toLowerCase() === floorQuery.toLowerCase()
        );

        if (!floorKey) {
            const message = this.createChatBotMessage(`No specific rooms found for the ${floorQuery}. Please try another floor or block.`);
            this.updateChatbotState(message);
            return;
        }

        const floorData = this.campusMap[blockKey][floorKey];

        const initialDirection = this.locationDirections[blockKey] || "";

        const directionMsg = this.createChatBotMessage(
            `Great! You are heading to the **${floorKey}**. (Context: ${initialDirection}).`
        );
        const message = this.createChatBotMessage(
            `Now, please select the room or section you are looking for:`,
            {
                widget: "roomOptions",
                payload: { floor: floorKey, rooms: floorData },
            }
        );
        this.updateChatbotState(directionMsg);
        this.updateChatbotState(message);

    }


    // --- 5. Handler for Room Selection (Step 3) ---
    handleRoomSelect = (roomQuery) => {
        // roomQuery example: "d block Ground Floor dl-001"

        // 1️⃣ Extract room ID (last word)
        const roomID = roomQuery.split(' ').pop();

        // 2️⃣ Find the block key in campusMap that matches the start of roomQuery
        const blockKey = Object.keys(this.campusMap).find(key =>
            roomQuery.toLowerCase().startsWith(key.toLowerCase())
        );

        if (!blockKey) {
            const message = this.createChatBotMessage(`Invalid block selected.`);
            this.updateChatbotState(message);
            return;
        }

        // 3️⃣ Find the floor key in the block that is included in roomQuery
        const floorKey = Object.keys(this.campusMap[blockKey]).find(floor =>
            roomQuery.toLowerCase().includes(floor.toLowerCase())
        );

        if (!floorKey) {
            const message = this.createChatBotMessage(`No rooms found for this floor. Please try again.`);
            this.updateChatbotState(message);
            return;
        }

        // 4️⃣ Find the room details
        const floorRooms = this.campusMap[blockKey][floorKey] || [];
        const roomDetail = floorRooms.find(room => room.id === roomID);

        const answer = roomDetail
            ? `To reach **${roomDetail.name}** in ${floorKey},\n
            Directions: ${roomDetail.direction}`
            : `Error: Could not find directions for room ID ${roomID}.`;

        // 5️⃣ Update chat state
        const message = this.createChatBotMessage(answer);
        this.updateChatbotState(message);
    };




    updateChatbotState(message) {
        this.setState(prevState => ({
            ...prevState,
            messages: [...prevState.messages, message]
        }));
    }
}
export default ActionProvider;