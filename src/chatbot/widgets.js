import React from "react";

// The component for the Floor selection menu
const FloorOptions = (props) => {
    const { actionProvider } = props;
    const block = props.payload.block; // Get the block name passed from ActionProvider

    // Try payload.options first (preferred). If not provided, derive from actionProvider.campusMap
    let availableFloors = props.payload?.options;
    if (!availableFloors || !Array.isArray(availableFloors) || availableFloors.length === 0) {
        // attempt to read from actionProvider.campusMap using block key (case-insensitive)
        const blockKey = Object.keys(actionProvider.campusMap || {}).find(k => k.toLowerCase() === (block || "").toLowerCase());
        if (blockKey) {
            availableFloors = Object.keys(actionProvider.campusMap[blockKey]).filter(k => k.toLowerCase() !== "direction");
        } else {
            // fallback to the original static list if nothing found
            availableFloors = [
                `${(block || "").toLowerCase()} Ground Floor`,
                `${(block || "").toLowerCase()} 1st Floor`,
                `${(block || "").toLowerCase()} 2nd Floor`,
                `${(block || "").toLowerCase()} 3rd Floor`,
                `${(block || "").toLowerCase()} 4th Floor`,
                `${(block || "").toLowerCase()} 5th Floor`,
            ];
        }
    }

    const floors = availableFloors.map((floorKey) => {
        // Short label: remove the leading "<block> " from the full floor key (case-insensitive)
        const shortName = floorKey.replace(new RegExp(`^${(block || "").replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+`, "i"), "");
        return {
            text: shortName || floorKey,
            handler: () => actionProvider.handleFloorSelect(floorKey)
        };
    });

    return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "10px" }}>
            {floors.map((option, index) => (
                <button
                    key={index}
                    onClick={option.handler}
                    style={{
                        padding: "8px 12px",
                        backgroundColor: "#000000ff", // Dark background for buttons
                        color: "#ffffffff",        // Cyan text color
                        border: "1px solid #ffffffff",
                        borderRadius: "15px",
                        cursor: "pointer",
                        fontWeight: "bold",
                        transition: "background-color 0.2s, color 0.2s",
                    }}
                    onMouseOver={(e) => { e.currentTarget.style.backgroundColor = "#023030ff"; e.currentTarget.style.color = "#000"; }}
                    onMouseOut={(e) => { e.currentTarget.style.backgroundColor = "#333"; e.currentTarget.style.color = "#ffffffff"; }}
                >
                    {option.text}
                </button>
            ))}
        </div>
    );
};

// The component for the Room selection menu
const RoomOptions = (props) => {
    const { actionProvider } = props;
    const { floor, rooms } = props.payload; // Get floor name and rooms data

    const roomButtons = rooms.map((room, index) => (
        <button
            key={index}
            onClick={() => actionProvider.handleRoomSelect(`${floor} ${room.id}`)}
            style={{
                padding: "8px 12px",
                backgroundColor: "#333",
                color: "#0a2929ff",
                border: "1px solid #072626ff",
                borderRadius: "15px",
                cursor: "pointer",
                fontWeight: "bold",
                transition: "background-color 0.2s, color 0.2s",
            }}
            onMouseOver={(e) => { e.currentTarget.style.backgroundColor = "#002323ff"; e.currentTarget.style.color = "#000"; }}
            onMouseOut={(e) => { e.currentTarget.style.backgroundColor = "#333"; e.currentTarget.style.color = "#ffffffff"; }}
        >
            {room.name}
        </button>
    ));

    return (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", marginTop: "10px" }}>
            {roomButtons}
        </div>
    );
};

export { FloorOptions, RoomOptions };
