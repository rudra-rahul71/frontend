export type ToolCallHandler = (name: string, args: any) => void;
export type AudioResponseHandler = (base64Audio: string, mimeType: string) => void;
export type TextResponseHandler = (text: string) => void;
export type TurnCompleteHandler = () => void;

export class AudioWebSocketClient {
    private ws: WebSocket | null = null;
    private serverUrl: string;
    private onToolCall: ToolCallHandler;
    private onAudioResponse: AudioResponseHandler | null;
    private onTextResponse: TextResponseHandler | null;
    private onTurnComplete: TurnCompleteHandler | null;

    constructor(
        serverUrl: string,
        onToolCall: ToolCallHandler,
        onAudioResponse?: AudioResponseHandler,
        onTextResponse?: TextResponseHandler,
        onTurnComplete?: TurnCompleteHandler
    ) {
        this.serverUrl = serverUrl;
        this.onToolCall = onToolCall;
        this.onAudioResponse = onAudioResponse || null;
        this.onTextResponse = onTextResponse || null;
        this.onTurnComplete = onTurnComplete || null;
    }

    connect() {
        this.ws = new WebSocket(`${this.serverUrl}/ws/audio`);
        
        this.ws.onopen = () => {
            console.log('Connected to Audio WebSocket');
        };

        this.ws.onmessage = (e) => {
            try {
                const message = JSON.parse(e.data);
                switch (message.type) {
                    case 'tool_call':
                        this.onToolCall(message.function, message.args);
                        break;
                    case 'audio_response':
                        this.onAudioResponse?.(message.data, message.mime_type);
                        break;
                    case 'text_response':
                        this.onTextResponse?.(message.text);
                        break;
                    case 'turn_complete':
                        this.onTurnComplete?.();
                        break;
                    default:
                        console.log('Unknown message type:', message.type);
                }
            } catch (err) {
                console.error("Failed to parse websocket message", err);
            }
        };

        this.ws.onerror = (e) => {
            console.error('WebSocket Error', e);
        };

        this.ws.onclose = () => {
            console.log('WebSocket Disconnected');
        };
    }

    sendAudioChunk(base64Data: string) {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify({ type: 'audio_chunk', data: base64Data }));
        }
    }

    disconnect() {
        if (this.ws) {
            if (this.ws.readyState === WebSocket.OPEN) {
                this.ws.send(JSON.stringify({ type: 'stop' }));
            }
            this.ws.close();
            this.ws = null;
        }
    }
}
