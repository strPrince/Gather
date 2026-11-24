declare module 'y-websocket/bin/utils' {
  import { IncomingMessage } from 'http';
  import * as WebSocket from 'ws';

  export function setupWSConnection(conn: WebSocket, req: IncomingMessage, options?: any): void;
  export const pingTimeout: number;
  export const wsOptions: any;
}

declare module 'y-websocket' {
  export * from 'y-websocket/bin/utils';
}
