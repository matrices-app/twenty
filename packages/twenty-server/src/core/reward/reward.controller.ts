import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { WorkspaceDataSourceService } from 'src/engine/workspace-datasource/workspace-datasource.service';

type TaskHandler = (dataSource: any, schemaName: string) => Promise<number>;

const taskHandlers: Record<string, TaskHandler> = {
  // Rewards this task: Delete all people that work at Microsoft
  'delete-microsoft': async (dataSource, schemaName) => {
    const microsoftPersons = await dataSource.query(
      `SELECT p.* 
       FROM ${schemaName}.person p
       JOIN ${schemaName}.company c ON p."companyId" = c.id
       WHERE c.name ILIKE 'microsoft'
         AND p."deletedAt" IS NULL`,
    );
    return microsoftPersons.length === 0 ? 10 : 0;
  },

  // Rewards this task: Create a view that filters people down to those that work at Chegg Inc. Call the view "Chegg only".
  'chegg-only': async (dataSource, schemaName) => {
    const viewFilter = await dataSource.query(
      `SELECT vf.* 
       FROM ${schemaName}.view v
       JOIN ${schemaName}."viewFilter" vf ON v.id = vf."viewId"
       WHERE v.name = 'Chegg only'
         AND vf."fieldMetadataId" = 'cdd372d1-311c-4077-8455-aee0e398fd4b'
         AND vf.value = '{"isCurrentWorkspaceMemberSelected":false,"selectedRecordIds":["d387e53b-7993-4a3b-9e6f-5c32c69f9e33"]}'`,
    );
    return viewFilter.length > 0 ? 5 : 0;
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
