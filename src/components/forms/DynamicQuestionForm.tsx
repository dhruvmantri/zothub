import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FormQuestion } from "@/types";

export interface DynamicQuestionFormProps {
  questions: FormQuestion[];
  answers: Record<string, string | string[]>;
  errors: Record<string, string>;
  onAnswerChange: (questionId: string, value: string | string[]) => void;
  className?: string;
}

/**
 * Shared component for rendering dynamic form questions.
 * Used by ApplicationForm and RSVPForm for consistent question rendering.
 */
export function DynamicQuestionForm({
  questions,
  answers,
  errors,
  onAnswerChange,
  className,
}: DynamicQuestionFormProps) {
  const toggleMultipleChoice = (questionId: string, option: string) => {
    const currentValue = (answers[questionId] as string[]) || [];
    const newValue = currentValue.includes(option)
      ? currentValue.filter((v) => v !== option)
      : [...currentValue, option];
    onAnswerChange(questionId, newValue);
  };

  const renderQuestion = (question: FormQuestion, index: number) => {
    const hasError = !!errors[question.id];

    return (
      <div key={question.id} className="space-y-3">
        <Label
          htmlFor={`question-${question.id}`}
          className={cn("text-base", hasError && "text-destructive")}
        >
          {index + 1}. {question.question}
          {question.required && <span className="text-destructive ml-1">*</span>}
        </Label>

        {question.type === "short_text" && (
          <Input
            id={`question-${question.id}`}
            placeholder={question.placeholder || "Your answer..."}
            value={(answers[question.id] as string) || ""}
            onChange={(e) => onAnswerChange(question.id, e.target.value)}
            className={cn(hasError && "border-destructive")}
          />
        )}

        {question.type === "long_text" && (
          <Textarea
            id={`question-${question.id}`}
            placeholder={question.placeholder || "Your answer..."}
            value={(answers[question.id] as string) || ""}
            onChange={(e) => onAnswerChange(question.id, e.target.value)}
            rows={4}
            className={cn(hasError && "border-destructive")}
          />
        )}

        {question.type === "single_choice" && question.options && (
          <RadioGroup
            value={(answers[question.id] as string) || ""}
            onValueChange={(value) => onAnswerChange(question.id, value)}
            className="space-y-2"
          >
            {question.options.map((option) => (
              <div key={option} className="flex items-center space-x-2">
                <RadioGroupItem value={option} id={`${question.id}-${option}`} />
                <Label
                  htmlFor={`${question.id}-${option}`}
                  className="font-normal cursor-pointer"
                >
                  {option}
                </Label>
              </div>
            ))}
          </RadioGroup>
        )}

        {question.type === "multiple_choice" && question.options && (
          <div className="space-y-2">
            {question.options.map((option) => {
              const currentValue = (answers[question.id] as string[]) || [];
              const isChecked = currentValue.includes(option);

              return (
                <div key={option} className="flex items-center space-x-2">
                  <Checkbox
                    id={`${question.id}-${option}`}
                    checked={isChecked}
                    onCheckedChange={() => toggleMultipleChoice(question.id, option)}
                  />
                  <Label
                    htmlFor={`${question.id}-${option}`}
                    className="font-normal cursor-pointer"
                  >
                    {option}
                  </Label>
                </div>
              );
            })}
          </div>
        )}

        {hasError && (
          <p className="text-sm text-destructive flex items-center gap-1">
            <AlertCircle className="w-3 h-3" />
            {errors[question.id]}
          </p>
        )}
      </div>
    );
  };

  if (questions.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-6", className)}>
      {questions.map((q, index) => renderQuestion(q, index))}
    </div>
  );
}

/**
 * Hook for managing dynamic question form state and validation.
 */
export function useDynamicQuestionForm(questions: FormQuestion[]) {
  const validateAnswers = (answers: Record<string, string | string[]>) => {
    const newErrors: Record<string, string> = {};

    questions.forEach((q) => {
      if (q.required) {
        const answer = answers[q.id];
        if (!answer || (Array.isArray(answer) && answer.length === 0)) {
          newErrors[q.id] = "This field is required";
        } else if (typeof answer === "string" && answer.trim() === "") {
          newErrors[q.id] = "This field is required";
        }
      }
    });

    return {
      isValid: Object.keys(newErrors).length === 0,
      errors: newErrors,
    };
  };

  return { validateAnswers };
}
