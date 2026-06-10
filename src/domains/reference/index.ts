import { z } from "zod";

import { detailsRenderer, formatValue, tableRenderer } from "../../cli/output.ts";
import { standaloneEntry, type RegistryEntry } from "../domain.ts";
import { limitField, offsetField } from "../fields.ts";
import { defineOperation } from "../operation.ts";
import { getEnums, listCostCategories, listPermissions } from "./api.ts";

const listInput = z.object({ limit: limitField, offset: offsetField });

export const permissionsEntry: RegistryEntry = standaloneEntry(
  defineOperation({
    name: "permissions",
    description: "List the system permissions assignable to positions. Shows ID, name and code.",
    input: listInput,
    run: (input) => listPermissions(input),
  }),
  {
    render: tableRenderer([
      ["ID", (permission) => formatValue(permission.id)],
      ["Name", (permission) => formatValue(permission.name)],
      ["Value", (permission) => formatValue(permission.value)],
    ]),
  },
);

export const costCategoriesEntry: RegistryEntry = standaloneEntry(
  defineOperation({
    name: "cost-categories",
    description:
      "List the cost categories that classify logged work. Shows name, parent category and whether " +
      "standard logging rules apply.",
    input: listInput,
    run: (input) => listCostCategories(input),
  }),
  {
    render: tableRenderer([
      ["ID", (category) => formatValue(category.id)],
      ["Name", (category) => formatValue(category.name)],
      ["Parent", (category) => formatValue(category.parentCategoryName)],
      ["Active", (category) => formatValue(category.active)],
    ]),
  },
);

export const enumsEntry: RegistryEntry = standaloneEntry(
  defineOperation({
    name: "enums",
    description:
      "List the server's enumerations: office absence types and states, game leagues and bonus XP donor types.",
    input: z.object({}),
    run: () => getEnums(),
  }),
  {
    render: detailsRenderer([
      ["Absence types", (enums) => formatValue(enums.officeAbsenceTypes?.join(", "))],
      ["Absence states", (enums) => formatValue(enums.officeAbsenceStates?.join(", "))],
      ["Game leagues", (enums) => formatValue(enums.gameLeagues?.join(", "))],
      ["Bonus XP donors", (enums) => formatValue(enums.bonusXpDonorTypes?.join(", "))],
    ]),
  },
);
