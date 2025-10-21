class MessageParser {
    constructor(actionProvider) {
        this.actionProvider = actionProvider;
    }

    parse(message) {
        const lower = message.toLowerCase();

        // Ensure that direct selections from the widget (like "A Block 1st Floor") are also passed
        // to the handleQuery method, where the ActionProvider will route it correctly.
        this.actionProvider.handleQuery(lower);
    }
}

export default MessageParser;