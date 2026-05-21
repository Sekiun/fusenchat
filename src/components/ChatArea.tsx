import { useEffect, useRef } from "react";
import type { BubbleItem } from "../types";
import { BubbleCard } from "./BubbleCard";

type ChatAreaProps = {
  bubbles: BubbleItem[];
  onOpenFolder: (bubble: BubbleItem) => Promise<void> | void;
  onCopyPath: (bubble: BubbleItem) => Promise<void> | void;
  onCopyImage: (bubble: BubbleItem) => Promise<void> | void;
  onDelete: (bubble: BubbleItem) => Promise<void> | void;
};

export function ChatArea(props: ChatAreaProps): JSX.Element {
  const { bubbles } = props;
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) {
      return;
    }

    element.scrollTop = element.scrollHeight;
  }, [bubbles]);

  return (
    <main ref={scrollRef} className="chat-area">
      {bubbles.length === 0 ? (
        <div className="chat-empty">
          <p>Enter でテキストを PNG バブル化します。</p>
          <p>生成した PNG を入力欄へドロップすると、埋め込んだ文字列を追記します。</p>
        </div>
      ) : (
        bubbles.map((bubble) => (
          <BubbleCard
            key={bubble.id}
            bubble={bubble}
            onOpenFolder={props.onOpenFolder}
            onCopyPath={props.onCopyPath}
            onCopyImage={props.onCopyImage}
            onDelete={props.onDelete}
          />
        ))
      )}
    </main>
  );
}
