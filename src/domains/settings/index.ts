import { z } from "zod";

import { callApi } from "../../api/client.ts";
import { zMerchRequestResultDto, zSettingsDto } from "../../api/generated/zod.gen.ts";
import { v3 } from "../../api/paths.ts";
import { detailsRenderer, formatName, formatValue, printSuccess } from "../../cli/output.ts";
import { defineAction, defineDomain, standaloneEntry, type RegistryEntry } from "../domain.ts";
import { idField } from "../fields.ts";
import { defineOperation } from "../operation.ts";

const settingsPath = v3("settings");

type Settings = z.infer<typeof zSettingsDto>;

async function getSettings(): Promise<Settings> {
  return zSettingsDto.parse(await callApi(settingsPath));
}

async function updateSettings(options: {
  backupAbsenceApproverId: number;
  feedbackCrontab: string;
  slackAbsenceChannel: string;
  slackErrorChannel: string;
  slackSchedulerChannel: string;
  maxWorklogHours: number;
  merchEmailReceiver: string;
  merchProducts: string;
}): Promise<Settings> {
  return zSettingsDto.parse(await callApi(settingsPath, { method: "POST", body: options }));
}

const settingsDetails = detailsRenderer<Settings>([
  ["Backup approver", (settings) => formatName(settings.backupAbsenceApprover)],
  ["Feedback crontab", (settings) => formatValue(settings.feedbackCrontab)],
  ["Slack absences", (settings) => formatValue(settings.slackAbsenceChannel)],
  ["Slack errors", (settings) => formatValue(settings.slackErrorChannel)],
  ["Slack scheduler", (settings) => formatValue(settings.slackSchedulerChannel)],
  ["Max worklog hours", (settings) => formatValue(settings.maxWorklogHours)],
  ["Merch email", (settings) => formatValue(settings.merchEmailReceiver)],
  ["Merch products", (settings) => formatValue(settings.merchProducts)],
]);

export const settingsDomain: RegistryEntry = defineDomain({
  name: "settings",
  description: "Global configuration: approvers, channels, limits.",
  actions: [
    defineAction({
      action: "show",
      description:
        "Show the global TF Hub settings: backup absence approver, Slack notification channels, daily worklog " +
        "hour limit, feedback schedule and merch configuration.",
      input: z.object({}),
      run: () => getSettings(),
      render: settingsDetails,
    }),
    defineAction({
      action: "update",
      description:
        "Update the global TF Hub settings (admin). All fields are persisted as given — read `settings-show` " +
        "first and pass current values for fields you do not want to change.",
      input: z.object({
        backupAbsenceApproverId: idField("Numeric ID of the collaborator acting as the backup absence approver."),
        feedbackCrontab: z.string().describe("Cron expression for the periodic feedback collection."),
        slackAbsenceChannel: z.string().describe("Slack channel for absence notifications."),
        slackErrorChannel: z.string().describe("Slack channel for error reporting."),
        slackSchedulerChannel: z.string().describe("Slack channel for scheduler notifications."),
        maxWorklogHours: z.coerce.number().min(1).describe("Maximum hours that can be logged per day."),
        merchEmailReceiver: z.string().describe("Email address that receives merch requests."),
        merchProducts: z.string().describe("Available merch products (comma-separated list as configured in the Hub)."),
      }),
      run: (input) => updateSettings(input),
      render: settingsDetails,
    }),
  ],
});

export const merchRequestEntry: RegistryEntry = standaloneEntry(
  defineOperation({
    name: "merch-request",
    description:
      "Request company merchandise for the signed-in user. The request (e.g. a t-shirt) is emailed to the " +
      "merch coordinator. Available products are listed in `settings-show` (merchProducts).",
    input: z.object({
      product: z.string().min(1).describe("The merch product to request."),
    }),
    async run(input) {
      return zMerchRequestResultDto.parse(await callApi(v3("merch-request"), { method: "POST", body: input }));
    },
  }),
  {
    positionals: ["product"],
    render(result) {
      printSuccess(`Merch request sent (${result.status ?? "OK"}).`);
    },
  },
  { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
);
