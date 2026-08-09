import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { ArrowLeft, Loader2, Mail, RefreshCw } from "lucide-react";

interface OTPVerificationProps {
  email: string;
  expiresAt: string;
  onVerify: (code: string) => Promise<void>;
  onResend: () => Promise<void>;
  onBack: () => void;
  isVerifying: boolean;
  error?: string;
  /** Blocks "Resend code" until the captcha (below) has produced a fresh token. */
  resendDisabled?: boolean;
  /** Captcha widget rendered next to the resend control (tokens are single-use, so
   *  a resend needs its own fresh challenge). */
  resendSlot?: React.ReactNode;
}

export function OTPVerification({
  email,
  expiresAt,
  onVerify,
  onResend,
  onBack,
  isVerifying,
  error,
  resendDisabled = false,
  resendSlot,
}: OTPVerificationProps) {
  const [code, setCode] = useState("");
  const [timeLeft, setTimeLeft] = useState(0);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isResending, setIsResending] = useState(false);

  // Calculate time remaining until expiry
  useEffect(() => {
    const calculateTimeLeft = () => {
      const expiry = new Date(expiresAt).getTime();
      const now = Date.now();
      const diff = Math.max(0, Math.floor((expiry - now) / 1000));
      setTimeLeft(diff);
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      const timer = setTimeout(() => setResendCooldown(resendCooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendCooldown]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleComplete = async (value: string) => {
    setCode(value);
    if (value.length === 6) {
      await onVerify(value);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    try {
      await onResend();
      setResendCooldown(60); // 60 second cooldown
      setCode(""); // Clear the code
    } finally {
      setIsResending(false);
    }
  };

  const isExpired = timeLeft === 0;

  return (
    <div className="space-y-6">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        disabled={isVerifying}
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <div className="text-center space-y-2">
        <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-4">
          <Mail className="w-8 h-8 text-accent" />
        </div>
        <h1 className="font-display text-2xl font-bold text-foreground">
          Check your email
        </h1>
        <p className="text-muted-foreground">
          We sent a 6-digit code to{" "}
          <span className="font-medium text-foreground">{email}</span>
        </p>
      </div>

      <div className="flex justify-center">
        <InputOTP
          maxLength={6}
          value={code}
          onChange={handleComplete}
          disabled={isVerifying || isExpired}
        >
          <InputOTPGroup>
            <InputOTPSlot index={0} />
            <InputOTPSlot index={1} />
            <InputOTPSlot index={2} />
            <InputOTPSlot index={3} />
            <InputOTPSlot index={4} />
            <InputOTPSlot index={5} />
          </InputOTPGroup>
        </InputOTP>
      </div>

      {error && (
        <p className="text-center text-sm text-destructive">{error}</p>
      )}

      {isVerifying && (
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Verifying...</span>
        </div>
      )}

      <div className="text-center space-y-4">
        {isExpired ? (
          <p className="text-sm text-destructive">
            Code expired. Please request a new one.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Code expires in{" "}
            <span className="font-medium text-foreground">{formatTime(timeLeft)}</span>
          </p>
        )}

        {resendSlot && <div className="flex justify-center">{resendSlot}</div>}

        <Button
          variant="ghost"
          size="sm"
          onClick={handleResend}
          disabled={resendCooldown > 0 || isResending || isVerifying || resendDisabled}
          className="gap-2"
        >
          {isResending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          {resendCooldown > 0
            ? `Resend in ${resendCooldown}s`
            : "Resend code"}
        </Button>
      </div>

      <Button
        onClick={() => onVerify(code)}
        disabled={code.length !== 6 || isVerifying || isExpired}
        className="w-full"
        size="lg"
      >
        {isVerifying ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Verifying...
          </>
        ) : (
          "Verify Email"
        )}
      </Button>
    </div>
  );
}
