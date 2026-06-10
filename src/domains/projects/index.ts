import { z } from "zod";

import {
  detailsRenderer,
  formatName,
  formatValue,
  printJson,
  printSuccess,
  tableRenderer,
  type ColumnSpec,
} from "../../cli/output.ts";
import { defineAction, defineDomain, type RegistryEntry } from "../domain.ts";
import {
  commaSeparatedStringsField,
  dateField,
  explicitBooleanField,
  idField,
  jsonField,
  limitField,
  offsetField,
  uuidField,
} from "../fields.ts";
import {
  fetchSonarCloudMetrics,
  getProjectReport,
  getSonarCloudMetrics,
  listProjectLeaderHistory,
  listProjects,
  updateProject,
  updateProjectLeader,
  updateProjectReport,
  updateProjectReportNoteSchema,
  type Project,
} from "./api.ts";

const projectColumns: ColumnSpec<Project>[] = [
  ["ID", (project) => formatValue(project.id)],
  ["Name", (project) => formatValue(project.name)],
  ["Abbreviation", (project) => formatValue(project.abbreviation)],
  ["Active", (project) => formatValue(project.isActive)],
  ["Leader", (project) => formatName(project.leader)],
  ["Sitdown", (project) => formatValue(project.sitdownTime?.name)],
  ["UUID", (project) => formatValue(project.uuid)],
];

const projectDetails = detailsRenderer<Project>([
  ...projectColumns,
  ["Slack", (project) => formatValue(project.slackChannel?.name)],
  ["Show in sitdowns", (project) => formatValue(project.showInSitdowns)],
]);

export const projectsDomain: RegistryEntry = defineDomain({
  name: "projects",
  description: "Company projects: configuration, leaders, reports.",
  actions: [
    defineAction({
      action: "list",
      description:
        "List company projects (synced from TF-ERP): name, abbreviation, leader, Slack channel, sitdown time " +
        "slot and aggregated SonarCloud quality metrics.",
      input: z.object({ limit: limitField, offset: offsetField }),
      run: (input) => listProjects(input),
      render: tableRenderer(projectColumns),
    }),
    defineAction({
      action: "update",
      description:
        "Update a project's TF Hub configuration: SonarCloud integration, Slack channel, sitdown time slot and " +
        "sitdown visibility (project management). Core project data is synced from TF-ERP and cannot be edited here.",
      input: z.object({
        id: idField("Numeric ID of the project (see `projects-list`)."),
        sonarCloudProjectIds: commaSeparatedStringsField(
          "Comma-separated SonarCloud project keys to track for this project. Empty string removes all.",
        ).default([]),
        sonarCloudApiKey: z.string().describe("SonarCloud API key used to fetch metrics.").optional(),
        slackChannel: z.string().describe("Slack channel for project notifications, e.g. #project-x.").optional(),
        sitdownTimeId: idField("ID of the recurring sitdown time slot (see `sitdown-times-list`).").optional(),
        showInSitdowns: explicitBooleanField(
          "Whether the project appears in the sitdown agenda (true/false).",
        ).optional(),
      }),
      positionals: ["id"],
      run: (input) => updateProject(input),
      render: projectDetails,
    }),
    defineAction({
      action: "set-leader",
      description:
        "Assign a new project leader (team lead). The leadership starts from the given month (project management).",
      input: z.object({
        id: idField("Numeric ID of the project."),
        leaderId: idField("Numeric ID of the collaborator who becomes the leader."),
        fromMonth: z.coerce.number().int().min(1).max(12).describe("Month the leadership starts (1-12)."),
        fromYear: z.coerce.number().int().min(2000).max(2200).describe("Year the leadership starts, e.g. 2026."),
      }),
      positionals: ["id", "leaderId"],
      run: (input) => updateProjectLeader(input),
      render: projectDetails,
    }),
    defineAction({
      action: "leader-history",
      description: "Show the history of project leadership: who led which project and when.",
      input: z.object({}),
      run: () => listProjectLeaderHistory(),
      render: tableRenderer([
        ["Project", (entry) => formatName(entry.project)],
        ["Leader", (entry) => formatName(entry.leader)],
        ["From", (entry) => `${entry.fromYear ?? "?"}-${entry.fromMonth ?? "?"}`],
        ["To", (entry) => (typeof entry.toYear === "number" ? `${entry.toYear}-${entry.toMonth ?? "?"}` : "now")],
      ]),
    }),
    defineAction({
      action: "report",
      description:
        "Show the sitdown report of a project for a date: report title, current and previous goals and " +
        "unresolved points.",
      input: z.object({
        uuid: uuidField("UUID of the project."),
        date: dateField("Report date (YYYY-MM-DD), usually the sitdown date."),
      }),
      positionals: ["uuid", "date"],
      run: (input) => getProjectReport(input),
      render: printJson,
    }),
    defineAction({
      action: "report-update",
      description:
        "Update the sitdown report of a project: title, unresolved points and the current/previous goal notes.",
      input: z.object({
        uuid: uuidField("UUID of the project."),
        date: dateField("Report date (YYYY-MM-DD)."),
        companyProjectName: z.string().describe("Project name as used by the customer/company.").optional(),
        reportTitle: z.string().describe("Title of the report.").optional(),
        unresolvedPoints: z.string().describe("Summary of unresolved points.").optional(),
        currentNote: jsonField(
          updateProjectReportNoteSchema,
          'Current goal note as JSON: {"id":1,"text":"...","deadline":"YYYY-MM-DD"}.',
        ).optional(),
        previousNote: jsonField(
          updateProjectReportNoteSchema,
          'Previous goal note as JSON: {"id":1,"text":"...","deadline":"YYYY-MM-DD"}.',
        ).optional(),
      }),
      positionals: ["uuid", "date"],
      run: ({ previousNote, ...rest }) => updateProjectReport({ ...rest, prevNote: previousNote }),
      render: printJson,
    }),
  ],
});

export const sonarDomain: RegistryEntry = defineDomain({
  name: "sonar",
  description: "SonarCloud code-quality metrics of projects.",
  actions: [
    defineAction({
      action: "metrics",
      description:
        "Show stored SonarCloud code-quality metrics of a project: reliability, security, maintainability, " +
        "coverage, technical debt and issue counts, with aggregated values over time.",
      input: z.object({
        projectUuid: uuidField("UUID of the project (see `projects-list`)."),
        limit: limitField,
        offset: offsetField,
      }),
      positionals: ["projectUuid"],
      run: (input) => getSonarCloudMetrics(input),
      render: printJson,
    }),
    defineAction({
      action: "fetch",
      description: "Fetch fresh SonarCloud metrics for a project and store them. Requires a configured integration.",
      input: z.object({ projectUuid: uuidField("UUID of the project.") }),
      positionals: ["projectUuid"],
      async run(input) {
        await fetchSonarCloudMetrics(input);

        return { fetched: input.projectUuid };
      },
      render({ fetched }) {
        printSuccess(`SonarCloud metrics fetched for project ${fetched}.`);
      },
    }),
  ],
});
