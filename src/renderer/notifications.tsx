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

export function NotificationStack({ items, onDismiss }: NotificationStackProps) {
  if (items.length === 0) return null;
  return (
    <div style={stackStyle} aria-live="polite">
      {items.map((n) => (
        <div key={n.id} style={toastStyle} role="status">
          <span style={toastMessageStyle}>{n.message}</span>
          <button
            type="button"
            onClick={() => onDismiss(n.id)}
            aria-label="알림 닫기"
            style={dismissButtonStyle}
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  );
}

const stackStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 16,
  right: 16,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  zIndex: 1000,
  maxWidth: 360
};

const toastStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 8,
  padding: '10px 12px',
  background: '#1f2937',
  color: '#fff',
  borderRadius: 6,
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.15)',
  fontSize: 13,
  lineHeight: 1.4
};

const toastMessageStyle: React.CSSProperties = {
  flex: 1
};

const dismissButtonStyle: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: '#cbd5e1',
  cursor: 'pointer',
  padding: 0,
  fontSize: 14,
  lineHeight: 1
};
