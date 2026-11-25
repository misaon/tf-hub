import { colors } from "consola/utils";
import { z } from "zod";

import { callApi } from "../../api/client.ts";
import {
  zValidate1On1ResponseDto,
  zValidateGoalResponseDto,
  zValidateVisionResponseDto,
} from "../../api/generated/zod.gen.ts";
import { v3 } from "../../api/paths.ts";
import { formatValue, printDetails, stripControlCharacters, writeOutput } from "../../cli/output.ts";
import { defineAction, defineDomain, readOnlyAnnotations, type DomainAction, type RegistryEntry } from "../domain.ts";
import { oneOnOneRatings } from "../one-on-ones/api.ts";

type AiValidation = z.infer<typeof zValidateGoalResponseDto>;

async function validate(
  schema: z.ZodType<AiValidation>,
  path: string,
  body: Record<string, unknown>,
): Promise<AiValidation> {
  return schema.parse(await callApi(v3(path), { method: "POST", body }));
}

function renderValidation(validation: AiValidation): void {
  printDetails({
    Verdict: formatValue(validation.verdict),
    Score: formatValue(validation.score),
    "Can save": formatValue(validation.can_save),
  });

  for (const issue of validation.issues ?? []) {
    writeOutput(
      stripControlCharacters(
        `${colors.yellow(issue.severity ?? "issue")} ${issue.title ?? ""}: ${issue.message ?? ""}`,
      ),
    );
  }

  for (const suggestion of validation.suggestions ?? []) {
    writeOutput(colors.dim(`→ ${stripControlCharacters(suggestion)}`));
  }
}

const visionField = z
  .string()
  .min(1)
  .max(20_000)
  .describe("The person's vision the text should align with (see `vision-show`).");

const validateActions: DomainAction[] = [
  defineAction({
    action: "goal",
    description:
      "AI-check a goal draft before saving it. Checks clarity, achievability and alignment with the " +
      "person's vision. Returns a verdict (pass/needs_changes/fail), score, issues and suggestions.",
    input: z.object({
      goalDraft: z.string().min(1).max(5000).describe("The goal text to validate."),
      vision: visionField,
    }),
    // POST, but only computes a verdict — no Hub state changes.
    annotations: readOnlyAnnotations,
    run: (input) => validate(zValidateGoalResponseDto, "validate-goal", input),
    render: renderValidation,
  }),
  defineAction({
    action: "vision",
    description:
      "AI-check a long-term vision draft for quality before saving it. Returns a verdict " +
      "(pass/needs_changes/fail), score, issues and suggestions.",
    input: z.object({
      visionDraft: z.string().min(1).max(20_000).describe("The vision text to validate."),
    }),
    annotations: readOnlyAnnotations,
    run: (input) => validate(zValidateVisionResponseDto, "validate-vision", input),
    render: renderValidation,
  }),
  defineAction({
    action: "1on1",
    description:
      "AI-check 1on1 meeting notes before saving them. Checks clarity and completeness. Returns a verdict " +
      "(pass/needs_changes/fail), score, issues and suggestions.",
    input: z.object({
      oneOnOneDraft: z.string().min(1).max(5000).describe("The 1on1 notes to validate."),
      vision: visionField,
      collaboratorRating: z.enum(oneOnOneRatings).describe("Collaborator's own rating of the period.").optional(),
      companyRating: z.enum(oneOnOneRatings).describe("Company/manager rating of the period.").optional(),
      isFinancialMessage: z.boolean().default(false).describe("Whether the notes contain financial (salary) topics."),
    }),
    annotations: readOnlyAnnotations,
    run: (input) => validate(zValidate1On1ResponseDto, "validate-1on1", input),
    render: renderValidation,
  }),
];

export const validateDomain: RegistryEntry = defineDomain({
  name: "validate",
  description: "AI quality checks for goals, visions and 1on1 notes.",
  actions: validateActions,
});
