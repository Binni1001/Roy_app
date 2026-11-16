import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * Hộp xác nhận và hộp nhập lý do vẽ ngay trong app, thay cho window.confirm / window.prompt.
 * Hộp mặc định của trình duyệt trông lạc lõng khi app được cài lên điện thoại, và một số
 * trình duyệt nhúng chặn hẳn nó (luôn trả "Hủy"), làm nút bấm im lặng không làm gì.
 */

interface Request {
  message: string;
  confirmLabel: string;
  danger: boolean;
  /** Có ô nhập: trả chuỗi đã nhập, hoặc null khi hủy. */
  input: { placeholder: string; minLength: number } | null;
  resolve: (value: string | boolean | null) => void;
}

let current: Request | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());

function open(request: Omit<Request, "resolve">): Promise<string | boolean | null> {
  // Hộp cũ còn mở (hiếm) thì coi như bị hủy.
  current?.resolve(current.input ? null : false);
  return new Promise((resolve) => {
    current = { ...request, resolve };
    emit();
  });
}

function close(value: string | boolean | null) {
  const request = current;
  current = null;
  emit();
  request?.resolve(value);
}

export function confirmDialog(message: string, options: { confirmLabel?: string; danger?: boolean } = {}): Promise<boolean> {
  return open({ message, confirmLabel: options.confirmLabel ?? "Đồng ý", danger: options.danger ?? false, input: null }) as Promise<boolean>;
}

export function promptDialog(
  message: string,
  options: { confirmLabel?: string; placeholder?: string; minLength?: number; danger?: boolean } = {},
): Promise<string | null> {
  return open({
    message,
    confirmLabel: options.confirmLabel ?? "Đồng ý",
    danger: options.danger ?? false,
    input: { placeholder: options.placeholder ?? "", minLength: options.minLength ?? 1 },
  }) as Promise<string | null>;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => void listeners.delete(listener);
}

/** Đặt một lần ở gốc app. */
export function DialogHost() {
  const request = useSyncExternalStore(subscribe, () => current);
  const [text, setText] = useState("");
  const confirmRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!request) return;
    setText("");
    (request.input ? inputRef.current : confirmRef.current)?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(request.input ? null : false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [request]);

  if (!request) return null;
  const tooShort = request.input ? text.trim().length < request.input.minLength : false;

  return (
    <div className="dialog-backdrop" onClick={() => close(request.input ? null : false)}>
      <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dialog-message" onClick={(e) => e.stopPropagation()}>
        <p id="dialog-message">{request.message}</p>
        {request.input && (
          <textarea
            ref={inputRef}
            rows={3}
            maxLength={300}
            placeholder={request.input.placeholder}
            value={text}
            onChange={(e) => setText(e.target.value)}
            aria-label={request.message}
          />
        )}
        <div className="dialog-actions">
          <button type="button" className="btn btn-ghost btn-small" onClick={() => close(request.input ? null : false)}>
            Hủy
          </button>
          <button
            ref={confirmRef}
            type="button"
            className={`btn btn-small ${request.danger ? "btn-danger" : "btn-gold"}`}
            disabled={tooShort}
            onClick={() => close(request.input ? text.trim() : true)}
          >
            {request.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
