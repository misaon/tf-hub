import { z } from "zod";

import { callApi } from "../../api/client.ts";
import { zCostCategoriesDto, zEnumsDto, zPermissionsDto } from "../../api/generated/zod.gen.ts";
import { v2 } from "../../api/paths.ts";
import type { Paging } from "../shared.ts";

export type Permission = z.infer<typeof zPermissionsDto>;
export type CostCategory = z.infer<typeof zCostCategoriesDto>;
export type Enums = z.infer<typeof zEnumsDto>;

const permissionListSchema = z.array(zPermissionsDto);
const costCategoryListSchema = z.array(zCostCategoriesDto);

export async function listPermissions(options: Paging): Promise<Permission[]> {
  return permissionListSchema.parse(await callApi(v2("permissions"), { query: options }));
}

export async function listCostCategories(options: Paging): Promise<CostCategory[]> {
  return costCategoryListSchema.parse(await callApi(v2("cost-categories"), { query: options }));
}

export async function getEnums(): Promise<Enums> {
  return zEnumsDto.parse(await callApi(v2("enums")));
}
