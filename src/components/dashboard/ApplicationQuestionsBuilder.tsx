import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Plus,
  Trash2,
  GripVertical,
  AlignLeft,
  List,
  CheckSquare,
  Type,
  HelpCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { FormQuestion, QuestionType } from "@/types";

// Re-export for backward compatibility
export type { QuestionType, FormQuestion as ApplicationQuestion };

interface ApplicationQuestionsBuilderProps {
  questions: FormQuestion[];
  onChange: (questions: FormQuestion[]) => void;
}

const questionTypeConfig = {
  short_text: { label: "Short Answer", icon: Type, description: "Single line text" },
  long_text: { label: "Long Answer", icon: AlignLeft, description: "Multi-line text" },
  single_choice: { label: "Single Choice", icon: List, description: "Select one option" },
  multiple_choice: { label: "Multiple Choice", icon: CheckSquare, description: "Select multiple options" },
};

export function ApplicationQuestionsBuilder({ 
  questions, 
  onChange 
}: ApplicationQuestionsBuilderProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const generateId = () => `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  const addQuestion = (type: QuestionType) => {
    const newQuestion: FormQuestion = {
      id: generateId(),
      type,
      question: "",
      required: false,
      options: type === "single_choice" || type === "multiple_choice" ? ["Option 1", "Option 2"] : undefined,
    };
    onChange([...questions, newQuestion]);
    setExpandedId(newQuestion.id);
  };

  const updateQuestion = (id: string, updates: Partial<FormQuestion>) => {
    onChange(
      questions.map((q) => (q.id === id ? { ...q, ...updates } : q))
    );
  };

  const removeQuestion = (id: string) => {
    onChange(questions.filter((q) => q.id !== id));
    if (expandedId === id) setExpandedId(null);
  };

  const addOption = (questionId: string) => {
    const question = questions.find((q) => q.id === questionId);
    if (question?.options) {
      updateQuestion(questionId, {
        options: [...question.options, `Option ${question.options.length + 1}`],
      });
    }
  };

  const updateOption = (questionId: string, optionIndex: number, value: string) => {
    const question = questions.find((q) => q.id === questionId);
    if (question?.options) {
      const newOptions = [...question.options];
      newOptions[optionIndex] = value;
      updateQuestion(questionId, { options: newOptions });
    }
  };

  const removeOption = (questionId: string, optionIndex: number) => {
    const question = questions.find((q) => q.id === questionId);
    if (question?.options && question.options.length > 2) {
      const newOptions = question.options.filter((_, i) => i !== optionIndex);
      updateQuestion(questionId, { options: newOptions });
    }
  };

  const moveQuestion = (index: number, direction: "up" | "down") => {
    const newQuestions = [...questions];
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= questions.length) return;
    [newQuestions[index], newQuestions[newIndex]] = [newQuestions[newIndex], newQuestions[index]];
    onChange(newQuestions);
  };

  return (
    <div className="space-y-4">
      {/* Questions List */}
      {questions.length > 0 && (
        <div className="space-y-3">
          {questions.map((question, index) => {
            const config = questionTypeConfig[question.type];
            const isExpanded = expandedId === question.id;

            return (
              <Card
                key={question.id}
                className={cn(
                  "border transition-all",
                  isExpanded && "ring-2 ring-accent/40"
                )}
              >
                <CardContent className="p-4">
                  {/* Header */}
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden
                      className="mt-1 text-ink-3 cursor-grab"
                    >
                      <GripVertical className="w-4 h-4" />
                    </span>

                    <div className="flex-1 min-w-0">
                      <div
                        className="flex items-center gap-2 cursor-pointer"
                        onClick={() => setExpandedId(isExpanded ? null : question.id)}
                      >
                        <config.icon className="w-4 h-4 text-ink-3 shrink-0" />
                        <span className="font-medium text-ink truncate">
                          {question.question || "Untitled question"}
                        </span>
                        {question.required && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                            Required
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-ink-3 mt-0.5">{config.label}</p>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Move question up"
                        onClick={() => moveQuestion(index, "up")}
                        disabled={index === 0}
                      >
                        <span className="text-xs">↑</span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        aria-label="Move question down"
                        onClick={() => moveQuestion(index, "down")}
                        disabled={index === questions.length - 1}
                      >
                        <span className="text-xs">↓</span>
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-bad hover:bg-bad-wash hover:text-bad"
                        aria-label="Remove question"
                        onClick={() => removeQuestion(question.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Expanded Content */}
                  {isExpanded && (
                    <div className="mt-4 pl-7 space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor={`question-${question.id}`}>Question</Label>
                        <Input
                          id={`question-${question.id}`}
                          placeholder="Enter your question..."
                          value={question.question}
                          onChange={(e) => updateQuestion(question.id, { question: e.target.value })}
                        />
                      </div>

                      {/* Options for choice questions */}
                      {(question.type === "single_choice" || question.type === "multiple_choice") && (
                        <div className="space-y-2">
                          <Label>Options</Label>
                          <div className="space-y-2">
                            {question.options?.map((option, optionIndex) => (
                              <div key={optionIndex} className="flex gap-2">
                                <Input
                                  value={option}
                                  onChange={(e) => updateOption(question.id, optionIndex, e.target.value)}
                                  placeholder={`Option ${optionIndex + 1}`}
                                />
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`Remove option ${optionIndex + 1}`}
                                  onClick={() => removeOption(question.id, optionIndex)}
                                  disabled={question.options && question.options.length <= 2}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            ))}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => addOption(question.id)}
                              className="gap-2"
                            >
                              <Plus className="w-3 h-3" />
                              Add Option
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Placeholder for text questions */}
                      {(question.type === "short_text" || question.type === "long_text") && (
                        <div className="space-y-2">
                          <Label htmlFor={`placeholder-${question.id}`}>Placeholder (optional)</Label>
                          <Input
                            id={`placeholder-${question.id}`}
                            placeholder="Enter placeholder text..."
                            value={question.placeholder || ""}
                            onChange={(e) => updateQuestion(question.id, { placeholder: e.target.value })}
                          />
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-2 border-t border-line">
                        <div className="flex items-center gap-2">
                          <Switch
                            aria-label="Mark question as required"
                            id={`required-${question.id}`}
                            checked={question.required}
                            onCheckedChange={(checked) => updateQuestion(question.id, { required: checked })}
                          />
                          <Label htmlFor={`required-${question.id}`} className="text-sm">
                            Required
                          </Label>
                        </div>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Question Buttons */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {Object.entries(questionTypeConfig).map(([type, config]) => (
          <Button
            key={type}
            type="button"
            variant="outline"
            className="h-auto py-3 flex-col gap-1.5"
            onClick={() => addQuestion(type as QuestionType)}
          >
            <config.icon className="w-4 h-4" />
            <span className="text-xs">{config.label}</span>
          </Button>
        ))}
      </div>

      {questions.length === 0 && (
        <div className="rounded-lg border-2 border-dashed border-line py-8 text-center">
          <HelpCircle className="w-10 h-10 text-ink-3 mx-auto mb-3" />
          <p className="text-ink-2 mb-2">No application questions yet</p>
          <p className="text-sm text-ink-3">
            Click the buttons above to add questions applicants will answer
          </p>
        </div>
      )}
    </div>
  );
}
