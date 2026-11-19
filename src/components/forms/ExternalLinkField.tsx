import { ExternalLink } from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/**
 * The optional "use your own sign-up form" link on a club's posting forms (CP1,
 * maintainer decision 2026-11-19: clubs may add one themselves).
 *
 * Filled in, the post shows "Apply Externally" / "RSVP Externally" in place of
 * ZotHub's own, and ZotHub's questions and approval step stop applying — the
 * form says so, so a club is never surprised that its questions went unasked.
 *
 * It lives on the EDIT forms too, and must: an edit form that did not load and
 * save this field would quietly drop the link the first time anyone fixed a
 * typo (the C3 shape — a form overwriting what it never showed).
 */
export function ExternalLinkField({
  kind,
  value,
  onChange,
  error,
}: {
  kind: "event" | "opportunity";
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const isEvent = kind === "event";
  const id = "externalUrl";
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ExternalLink aria-hidden className="h-5 w-5 text-accent" />
          {isEvent ? "Your own sign-up form" : "Your own application form"}
        </CardTitle>
        <CardDescription>
          Optional. Already using a Google Form or another sign-up page? Paste its link and students
          will see {isEvent ? "“RSVP Externally”" : "“Apply Externally”"} instead of ZotHub's{" "}
          {isEvent ? "RSVP" : "application"}.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Label htmlFor={id}>Link</Label>
        <Input
          id={id}
          // type="text", not "url": the browser's own URL check refuses a link
          // pasted without "https://" (e.g. "forms.gle/abc") and blocks the whole
          // form before our check — which completes it — ever runs. inputMode
          // still brings up the web-address keyboard on a phone.
          type="text"
          inputMode="url"
          autoComplete="url"
          placeholder="https://forms.gle/…"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${hintId} ${errorId}` : hintId}
        />
        <p id={hintId} className="text-sm text-ink-3">
          {value.trim()
            ? isEvent
              ? "ZotHub's RSVP questions and approval step won't be used — sign-ups happen on your form."
              : "ZotHub's application questions won't be used — applications happen on your form."
            : isEvent
              ? "Leave it empty to take RSVPs on ZotHub."
              : "Leave it empty to take applications on ZotHub."}
        </p>
        {error && (
          <p id={errorId} role="alert" className="text-sm font-medium text-bad">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
