import { useEffect, useState } from "react";
import { envConfig } from "@/config";

type Status = "loading" | "ready" | "error";

const SDK_ID = "paypal-js-sdk";

export interface PayPalButtonsInstance {
  render: (container: HTMLElement) => Promise<void>;
  close: () => Promise<void>;
}

export interface PayPalButtonsConfig {
  style?: Record<string, string | number | boolean>;
  createOrder: () => Promise<string>;
  onApprove: (data: { orderID: string }) => Promise<void>;
  onError?: (error: unknown) => void;
  onCancel?: () => void;
}

declare global {
  interface Window {
    paypal?: {
      Buttons: (config: PayPalButtonsConfig) => PayPalButtonsInstance;
    };
  }
}

// Loads the PayPal JS SDK once. The intent is authorize because the API authorizes first, scores, then captures,
// holds or voids.
export function usePayPalSdk() {
  const clientId = envConfig.paypalClientId;
  const [status, setStatus] = useState<Status>(
    window.paypal ? "ready" : "loading",
  );

  useEffect(() => {
    if (!clientId || window.paypal) return;

    let script = document.getElementById(SDK_ID) as HTMLScriptElement | null;
    if (!script) {
      script = document.createElement("script");
      script.id = SDK_ID;
      script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=authorize&components=buttons`;
      script.async = true;
      document.body.appendChild(script);
    }

    const onLoad = () => setStatus("ready");
    const onError = () => setStatus("error");
    script.addEventListener("load", onLoad);
    script.addEventListener("error", onError);
    return () => {
      script?.removeEventListener("load", onLoad);
      script?.removeEventListener("error", onError);
    };
  }, [clientId]);

  return { status, configured: Boolean(clientId) };
}
