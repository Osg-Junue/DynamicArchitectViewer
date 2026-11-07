export type HostToWebviewMessage =
  | {
      type: 'docChanged';
      dsl: string;
      uri?: string;
    }
  | {
      type: 'cursorMoved';
      offset: number;
    };

export type WebviewToHostMessage =
  | {
      type: 'ready';
    }
  | {
      type: 'updateDsl';
      dsl: string;
    }
  | {
      type: 'revealRange';
      from: number;
      to: number;
    }
  | {
      type: 'exportHtml';
      dsl: string;
      locale?: 'ja' | 'en';
    }
  | {
      type: 'formatDocument';
    };
