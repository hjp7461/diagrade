import { useCallback, useState } from 'react';

interface Notification {
  id: string;
  message: string;
}

const AUTO_DISMISS_MS = 5000;

export function useNotifications() {
  const [items, setItems] = useState<Notification[]>([]);

  const push = useCallback((message: string) => {
    const id = crypto.randomUUID();
    setItems((prev) => [...prev, { id, message }]);
    setTimeout(() => {
      setItems((prev) => prev.filter((n) => n.id !== id));
    }, AUTO_DISMISS_MS);
  }, []);

  const dismiss = useCallback((id: string) => {
    setItems((prev) => prev.filter((n) => n.id !== id));
  }, []);

  return { items, push, dismiss };
}

interface NotificationStackProps {
  items: Notification[];
  onDismiss: (id: string) => void;
}

/**
 * 토스트 스택. PRD-005 마이그레이션 — 색상은 CSS 변수, layout 은 inline.
 */
export function NotificationStack({ items, onDismiss }: NotificationStackProps) {
  if (items.length === 0) return null;
  return (
    <div className="diagrade-toast-stack" style={stackLayout} aria-live="polite">
      {items.map((n) => (
        <div key={n.id} className="diagrade-toast" style={toastLayout} role="status">
          <span className="diagrade-toast-message" style={toastMessageLayout}>
            {n.message}
          </span>
          <button
            type="button"
            className="diagrade-toast-dismiss"
            onClick={() => onDismiss(n.id)}
            aria-label="알림 닫기"
            style={dismissButtonLayout}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

const stackLayout: React.CSSProperties = {
  position: 'fixed',
  bottom: 16,
  right: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  zIndex: 1000,
  maxWidth: 360
};

const toastLayout: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
  padding: '10px 12px',
  borderRadius: 6,
  fontSize: 13,
  lineHeight: 1.4
};

const toastMessageLayout: React.CSSProperties = {
  flex: 1
};

const dismissButtonLayout: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  padding: 0,
  fontSize: 14,
  lineHeight: 1
};
