import { Controller, Get } from '@nestjs/common';
import { TwentyORMGlobalManager } from 'src/engine/twenty-orm/twenty-orm-global.manager';
import { WorkspaceDataSourceService } from 'src/engine/workspace-datasource/workspace-datasource.service';

@Controller('reset')
export class ResetController {
  constructor(
    private readonly twentyORMGlobalManager: TwentyORMGlobalManager,
    private readonly workspaceDataSourceService: WorkspaceDataSourceService,
  ) {}

  @Get()
  async reset() {
    try {
      const workspaceId = '3b8e6458-5fc1-4e63-8563-008ccddaa6db';
      
      // Get the schema name for the workspace
      const schemaName = this.workspaceDataSourceService.getSchemaName(workspaceId);
      
      // Get a datasource for the specific workspace
      const dataSource = await this.twentyORMGlobalManager.getDataSourceForWorkspace(workspaceId);
      
      // Execute query with correct schema
      const result = await dataSource.query(`SELECT * FROM ${schemaName}.person`);
      
      return { 
        message: 'Database reset successful',
        queryResult: result 
      };
    } catch (error) {
      throw error;
    }
  }
} 