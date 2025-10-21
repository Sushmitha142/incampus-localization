import { createChatBotMessage } from "react-chatbot-kit";
import { FloorOptions, RoomOptions } from "./widgets"; // Import the new widgets

const config = {
    botName: "CampusBot",
    initialMessages: [
        createChatBotMessage("Hi! Ask me about campus locations")
    ],
    widgets: [
        {
            widgetName: "floorOptions",
            widgetFunc: (props) => <FloorOptions {...props} />,
            // The state passed to this widget will contain the block name
        },
        {
            widgetName: "roomOptions",
            widgetFunc: (props) => <RoomOptions {...props} />,
            // The state passed to this widget will contain floor name and room data
        },
    ],
};

export default config;