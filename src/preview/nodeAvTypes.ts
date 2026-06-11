/** Duck-typed node-av shapes — no runtime import from node-av. */

export type NodeAvRational = {
  num: number;
  den: number;
};

export type NodeAvPacket = {
  free(): void;
};

export type NodeAvFrame = {
  width: number;
  height: number;
  pts: bigint;
  pktDts: bigint;
  bestEffortTimestamp: bigint;
  timeBase: NodeAvRational;
};

export type NodeAvStream = {
  index: number;
  startTime: bigint;
  timeBase: NodeAvRational;
  duration: bigint;
  codecpar: {
    width: number;
    height: number;
  };
};

export type NodeAvDemuxer = {
  duration: number;
  video(): NodeAvStream | null | undefined;
  seek(timestamp: number, streamIndex?: number, flags?: number): Promise<number>;
  packets(streamIndex: number): AsyncIterable<NodeAvPacket | null>;
  close(): Promise<void>;
};

export type NodeAvDecoder = {
  decodeAll(packet: NodeAvPacket): Promise<NodeAvFrame[]>;
  flush(): Promise<void>;
  [Symbol.dispose]?: () => void;
};

export type NodeAvScaler = {
  toBuffer(
    frame: NodeAvFrame,
    options: { format: string; resize?: { width: number; height: number } }
  ): Promise<Buffer>;
  toPng(
    frame: NodeAvFrame,
    options: { format: string; resize?: { width: number; height: number } }
  ): Promise<Buffer>;
  [Symbol.dispose]?: () => void;
};
