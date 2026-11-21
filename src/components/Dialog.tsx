import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export const Dialog: React.FC<{
  title: string;
  onClose: () => void;
  width?: number;
  children: React.ReactNode;
  footer?: React.ReactNode;
}> = ({ title, onClose, width = 460, children, footer }) => {
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    window.addEventListener('keydown', h, true);
    return () => window.removeEventListener('keydown', h, true);
  }, [onClose]);
  return (
    <div className="msx-modal-back no-print" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="msx-modal" role="dialog" aria-modal="true" aria-label={title} style={{ width }}>
        <header>
          <h3>{title}</h3>
          <button type="button" className="msx-btn" aria-label="Close" onClick={onClose}>
            <X size={16} />
          </button>
        </header>
        <div className="msx-modal-body">{children}</div>
        {footer && <footer>{footer}</footer>}
      </div>
    </div>
  );
};

export const Field: React.FC<{ label: string; children: React.ReactNode; hint?: string }> = ({ label, children, hint }) => (
  <label className="msx-field">
    <span>{label}</span>
    {children}
    {hint && <small>{hint}</small>}
  </label>
);
