import { Controller, Get } from '@nestjs/common';
import { WorkspaceManagerService } from 'src/engine/workspace-manager/workspace-manager.service';

@Controller('reset')
export class ResetController {
  constructor(
    private readonly workspaceManagerService: WorkspaceManagerService,
  ) {}

  @Get()
  async reset() {
    try {
      const workspaceId = '3b8e6458-5fc1-4e63-8563-008ccddaa6db';
      
      // Delete the existing workspace data
      await this.workspaceManagerService.delete(workspaceId);
      
      // Reinitialize the workspace with demo data
      await this.workspaceManagerService.initDemo(workspaceId);
      
      return { 
        message: 'Workspace reset successful',
      };
    } catch (error) {
      throw error;
    }
  }
} 