import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { WorkspaceDataSourceService } from 'src/engine/workspace-datasource/workspace-datasource.service';

type TaskHandler = (dataSource: any, schemaName: string) => Promise<number>;

const taskHandlers: Record<string, TaskHandler> = {
  // Rewards this task: Delete all people that work at Microsoft
  'delete-microsoft-people': async (dataSource, schemaName) => {
    const microsoftPersons = await dataSource.query(
      `SELECT p.* 
       FROM ${schemaName}.person p
       JOIN ${schemaName}.company c ON p."companyId" = c.id
       WHERE c.name ILIKE 'microsoft'
         AND p."deletedAt" IS NULL`,
    );

    const allMicrosoftPersons = await dataSource.query(
      `SELECT p.* 
       FROM ${schemaName}.person p
       JOIN ${schemaName}.company c ON p."companyId" = c.id
       WHERE c.name ILIKE 'microsoft'`,
    );

    // Check if all Microsoft employees are deleted (deletedAt is set)
    return microsoftPersons.length === 0 && allMicrosoftPersons.length > 0 ? 10 : 0;
  },

  // Rewards this task: Create a view that filters people down to those that work at Chegg Inc. Call the view "Chegg only".
  'chegg-only': async (dataSource, schemaName) => {
    // First get the Chegg Inc company ID
    const cheggCompany = await dataSource.query(
      `SELECT id FROM ${schemaName}.company 
       WHERE name = 'Chegg Inc.'
         AND "deletedAt" IS NULL
       LIMIT 1`
    );

    if (cheggCompany.length === 0) {
      return 0;
    }

    const viewFilter = await dataSource.query(
      `SELECT vf.* 
       FROM ${schemaName}.view v
       JOIN ${schemaName}."viewFilter" vf ON v.id = vf."viewId"
       WHERE v.name = 'Chegg only'
         AND vf."fieldMetadataId" = (
           SELECT id FROM metadata."fieldMetadata" 
           WHERE name = 'company'  
           LIMIT 1
         )
         AND vf.value = '{"isCurrentWorkspaceMemberSelected":false,"selectedRecordIds":["${cheggCompany[0].id}"]}'`,
    );
    return viewFilter.length > 0 ? 10 : 0;
  },

  // 1) Rename SLB to Schlumberger
  'rename-slb-to-schlumberger': async (dataSource, schemaName) => {
    // Check if there's a row with name = 'Schlumberger' and not deleted
    const schlumberger = await dataSource.query(
      `SELECT *
       FROM ${schemaName}.company
       WHERE name = 'Schlumberger'
         AND "deletedAt" IS NULL`
    );
    return schlumberger.length > 0 ? 10 : 0;
  },

  // 2) Mark all people from Uber as deleted
  'delete-uber-people': async (dataSource, schemaName) => {
    // All Uber folks originally
    const allUberPeople = await dataSource.query(
      `SELECT p.*
       FROM ${schemaName}.person p
       JOIN ${schemaName}.company c ON p."companyId" = c.id
       WHERE c.name ILIKE 'uber'`
    );
    // All Uber folks still active
    const activeUberPeople = await dataSource.query(
      `SELECT p.*
       FROM ${schemaName}.person p
       JOIN ${schemaName}.company c ON p."companyId" = c.id
       WHERE c.name ILIKE 'uber'
         AND p."deletedAt" IS NULL`
    );
    // Reward if no active Uber employees remain, but we had some to begin with
    return (activeUberPeople.length === 0 && allUberPeople.length > 0) ? 10 : 0;
  },

  // 3) Create a cat pet named "Bella"
  'create-cat-pet-bella': async (dataSource, schemaName) => {
    const bellaCat = await dataSource.query(
      `SELECT *
       FROM ${schemaName}._pet
       WHERE name = 'Bella'
         AND species = 'cat'
         AND "deletedAt" IS NULL`
    );
    return bellaCat.length > 0 ? 10 : 0;
  },

  // 4) Complete a task for Regina Williams (status = 'DONE')
  //   TODO: This is weird bc tasktarget is confusing
  'complete-task-for-regina-williams': async (dataSource, schemaName) => {
    const doneTasksForRegina = await dataSource.query(
      `SELECT t.*
       FROM ${schemaName}.task t
       JOIN ${schemaName}."taskTarget" tt ON t.id = tt."taskId"
       JOIN ${schemaName}.person p ON tt."personId" = p.id
       WHERE p."nameFirstName" ILIKE 'regina'
         AND p."nameLastName" ILIKE 'williams'
         AND t.status = 'DONE'
         AND t."deletedAt" IS NULL`
    );
    return doneTasksForRegina.length > 0 ? 10 : 0;
  },

  // 5) Mark Salesforce as the ideal customer profile
  'mark-salesforce-company-icp': async (dataSource, schemaName) => {
    const salesforceIcp = await dataSource.query(
      `SELECT *
       FROM ${schemaName}.company
       WHERE name ILIKE 'salesforce'
         AND "idealCustomerProfile" = true
         AND "deletedAt" IS NULL`
    );
    return salesforceIcp.length > 0 ? 10 : 0;
  },

  // 6) Rename city for Vicki Meyer from New Margaretshire to Old Margaretshire
  'rename-new-margaretshire-to-old': async (dataSource, schemaName) => {
    const vicki = await dataSource.query(
      `SELECT p.*
       FROM ${schemaName}.person p
       WHERE p."nameFirstName" ILIKE 'vicki'
         AND p."nameLastName" ILIKE 'meyer'
         AND p.city = 'Old Margaretshire'
         AND p."deletedAt" IS NULL`
    );
    return vicki.length > 0 ? 10 : 0;
  },

  // 7) Create an opportunity for Uber with an amount of $2,000 (2,000,000,000 micros)
  'create-opportunity-uber-2k': async (dataSource, schemaName) => {
    // Grab the ID of the Uber company
    const uberCompany = await dataSource.query(
      `SELECT id
       FROM ${schemaName}.company
       WHERE name ILIKE 'uber'
         AND "deletedAt" IS NULL
       LIMIT 1`
    );
    if (uberCompany.length === 0) {
      return 0;
    }

    // Check if there's an opportunity with that companyId, amount 2,000,000,000
    const opp = await dataSource.query(
      `SELECT *
       FROM ${schemaName}.opportunity
       WHERE "companyId" = $1
         AND "amountAmountMicros" = 2000000000
         AND "deletedAt" IS NULL`,
      [uberCompany[0].id]
    );
    return opp.length > 0 ? 10 : 0;
  },

  // 8) Add a note referencing Vicki Meyer that includes "hello" in bodyV2Markdown
  'add-note-vicki-meyer-hello': async (dataSource, schemaName) => {
    const matchingNotes = await dataSource.query(
      `SELECT n.*
       FROM ${schemaName}.note n
       JOIN ${schemaName}."noteTarget" nt ON n.id = nt."noteId"
       JOIN ${schemaName}.person p ON nt."personId" = p.id
       WHERE p."nameFirstName" ILIKE 'vicki'
         AND p."nameLastName" ILIKE 'meyer'
         AND n."bodyV2Markdown" ILIKE '%hello%'
         AND n."deletedAt" IS NULL
         AND nt."deletedAt" IS NULL`
    );
    return matchingNotes.length > 0 ? 10 : 0;
  },

  // 9) Blocklist Billy McKinney (billy.mckinney@example.com)
  'blocklist-billy-mckinney': async (dataSource, schemaName) => {
    const billyBlock = await dataSource.query(
      `SELECT *
       FROM ${schemaName}.blocklist
       WHERE handle = 'billy.mckinney@example.com'
         AND "deletedAt" IS NULL`
    );
    return billyBlock.length > 0 ? 10 : 0;
  },

  // 10) Rename company "Cisco" to "Cisco Systems"
  'rename-cisco-to-cisco-systems': async (dataSource, schemaName) => {
    const ciscoSystems = await dataSource.query(
      `SELECT *
       FROM ${schemaName}.company
       WHERE name = 'Cisco Systems'
         AND "deletedAt" IS NULL`
    );
    return ciscoSystems.length > 0 ? 10 : 0;
  },
};

@Controller('reward')
export class RewardController {
  constructor(
    private readonly workspaceDataSourceService: WorkspaceDataSourceService,
  ) {}

  @Get(':taskId')
  async getReward(@Param('taskId') taskId: string) {
    const handler = taskHandlers[taskId];

    if (!handler) {
      throw new NotFoundException(`Unknown task ID: ${taskId}`);
    }

    const workspaceId = '3b8e6458-5fc1-4e63-8563-008ccddaa6db';
    const dataSource =
      await this.workspaceDataSourceService.connectToWorkspaceDataSource(
        workspaceId,
      );
    const schemaName =
      this.workspaceDataSourceService.getSchemaName(workspaceId);

    const reward = await handler(dataSource, schemaName);

    return { taskId, reward };
  }
}