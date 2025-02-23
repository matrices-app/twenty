import { Controller, Get, NotFoundException, Param, Req } from '@nestjs/common';

import { Request } from 'express';

import { DomainManagerService } from 'src/engine/core-modules/domain-manager/services/domain-manager.service';
import { WorkspaceDataSourceService } from 'src/engine/workspace-datasource/workspace-datasource.service';

type TaskHandler = (dataSource: any, schemaName: string) => Promise<number>;


const taskHandlers: Record<string, TaskHandler> = {
  // 1) Delete all people that work at Microsoft
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

  // 2) Delete all people that work at Yardi
  'delete-yardi-people': async (dataSource, schemaName) => {
    // All Yardi folks originally
    const allYardiPeople = await dataSource.query(
      `SELECT p.*
       FROM ${schemaName}.person p
       JOIN ${schemaName}.company c ON p."companyId" = c.id
       WHERE c.name ILIKE 'yardi'`
    );
    // All Yardi folks still active
    const activeYardiPeople = await dataSource.query(
      `SELECT p.*
       FROM ${schemaName}.person p
       JOIN ${schemaName}.company c ON p."companyId" = c.id
       WHERE c.name ILIKE 'yardi'
         AND p."deletedAt" IS NULL`
    );
    // Reward if no active Yardi employees remain, but we had some to begin with
    return (activeYardiPeople.length === 0 && allYardiPeople.length > 0) ? 10 : 0;
  },

  // 3) Create a view that filters people down to those that work at Chegg Inc. Call the view "Chegg only".
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

  // 4) Rename SLB to Schlumberger
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

  // 5) Create a cat pet named "Bella"
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

  // 6) Mark Salesforce as the ideal customer profile
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

  // 7) Rename city for Vicki Meyer from New Margaretshire to Old Margaretshire
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

  // 8) Create an opportunity for Uber with an amount of $2,000 (2,000,000,000 micros)
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

  // 9) Add a note referencing Vicki Meyer as a relation that includes "hello" in the content
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

  // 10) Blocklist Billy McKinney (billy.mckinney@example.com)
  'blocklist-billy-mckinney': async (dataSource, schemaName) => {
    const billyBlock = await dataSource.query(
      `SELECT *
       FROM ${schemaName}.blocklist
       WHERE handle = 'billy.mckinney@example.com'
         AND "deletedAt" IS NULL`
    );
    return billyBlock.length > 0 ? 10 : 0;
  },

  // 11) Rename company "Cisco" to "Cisco Systems"
  'rename-cisco-to-cisco-systems': async (dataSource, schemaName) => {
    const ciscoSystems = await dataSource.query(
      `SELECT *
       FROM ${schemaName}.company
       WHERE name = 'Cisco Systems'
         AND "deletedAt" IS NULL`
    );
    return ciscoSystems.length > 0 ? 10 : 0;
  },

  // 12) Add 10 companies with their full details 
  'add-10-companies': async (dataSource, schemaName) => {
    const companies = [
      ['Nexora', 'https://nexora.com', '42 Innovation Street', 'Neo City', 'CA', '90210', 'United States'],
      ['Verital', 'https://verital.io', '99 Cloud Avenue', 'Redmond Heights', 'WA', '98052', 'United States'],
      ['Synthos', 'https://synthos.net', '18 Quantum Road', 'Silicon Bay', 'NY', '10001', 'United States'],
      ['Bytecore', 'https://bytecore.ai', '77 Neural Lane', 'Austin', 'TX', '73301', 'United States'],
      ['Omnatek', 'https://omnatek.com', '350 Future Blvd', 'San Francisco', 'CA', '94103', 'United States'],
      ['Zentrix', 'https://zentrix.org', '21 Horizon Drive', 'Seattle', 'WA', '98101', 'United States'],
      ['Cloudara', 'https://cloudara.co', '88 Skyline Avenue', 'Mountain View', 'CA', '94040', 'United States'],
      ['Datronix', 'https://datronix.dev', '55 Cipher Street', 'Boston', 'MA', '02108', 'United States'],
      ['Veltrix', 'https://veltrix.app', '10 Infinity Loop', 'Los Angeles', 'CA', '90012', 'United States'],
      ['NovaSys', 'https://novasys.tech', '33 Pioneer Road', 'Chicago', 'IL', '60601', 'United States'],
    ];

    let points = 0;

    for (const [name, domain, address, city, state, postalCode, country] of companies) {
      const companyExists = await dataSource.query(
        `SELECT *
         FROM ${schemaName}.company
         WHERE name = $1
           AND "domainNamePrimaryLinkUrl" = $2
           AND "addressAddressStreet1" = $3
           AND "addressAddressCity" = $4
           AND "addressAddressState" = $5
           AND "addressAddressPostcode" = $6
           AND "addressAddressCountry" = $7
           AND "deletedAt" IS NULL`,
        [name, domain, address, city, state, postalCode, country]
      );
      
      if (companyExists.length > 0) {
        points += 1;
      }
    }

    return points;
  },
};

@Controller('reward')
export class RewardController {
  constructor(
    private readonly workspaceDataSourceService: WorkspaceDataSourceService,
    private readonly domainManagerService: DomainManagerService,
  ) {}

  @Get(':taskId')
  async getReward(@Req() req: Request, @Param('taskId') taskId: string) {
    const handler = taskHandlers[taskId];

    if (!handler) {
      throw new NotFoundException(`Unknown task ID: ${taskId}`);
    }

    const origin = `${req.protocol}://${req.get('host')}`;

    const workspace =
      await this.domainManagerService.getWorkspaceByOriginOrDefaultWorkspace(
        origin,
      );

    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const workspaceId = workspace.id;
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
