import { Controller, Get, Req } from '@nestjs/common';

import { Request } from 'express';

import { DomainManagerService } from 'src/engine/core-modules/domain-manager/services/domain-manager.service';
import { WorkspaceManagerService } from 'src/engine/workspace-manager/workspace-manager.service';

@Controller('reset')
export class ResetController {
  constructor(
    private readonly workspaceManagerService: WorkspaceManagerService,
    private readonly domainManagerService: DomainManagerService,
  ) {}

  @Get()
  async reset(@Req() req: Request) {
    const origin = `${req.protocol}://${req.get('host')}`;

    const workspace =
      await this.domainManagerService.getWorkspaceByOriginOrDefaultWorkspace(
        origin,
      );

    if (!workspace) {
      throw new Error('Workspace not found');
    }

    const workspaceId = workspace.id;

    // Delete the existing workspace data
    await this.workspaceManagerService.delete(workspaceId);

    // Reinitialize the workspace with demo data
    await this.workspaceManagerService.initDemo(workspaceId);

    return {
      message: 'Workspace reset successful',
    };
  }
}
