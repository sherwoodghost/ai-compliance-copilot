import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { FrameworkType } from '@prisma/client';

@Injectable()
export class FrameworksService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll() {
    return this.prisma.framework.findMany({
      where: { isActive: true },
      include: {
        _count: { select: { controls: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findById(frameworkId: string) {
    const framework = await this.prisma.framework.findUnique({
      where: { id: frameworkId },
      include: { _count: { select: { controls: true } } },
    });
    if (!framework) throw new NotFoundException('Framework not found');
    return framework;
  }

  async findByType(type: FrameworkType) {
    const framework = await this.prisma.framework.findFirst({
      where: { type, isActive: true },
      orderBy: { version: 'desc' },
    });
    if (!framework) throw new NotFoundException(`No active framework of type ${type}`);
    return framework;
  }

  async getControls(frameworkId: string, category?: string) {
    await this.findById(frameworkId);

    return this.prisma.control.findMany({
      where: {
        frameworkId,
        ...(category && { category }),
      },
      orderBy: [{ category: 'asc' }, { code: 'asc' }],
    });
  }

  async getCategories(frameworkId: string) {
    const controls = await this.prisma.control.groupBy({
      by: ['category'],
      where: { frameworkId },
      _count: { category: true },
      orderBy: { category: 'asc' },
    });
    return controls.map((c) => ({ category: c.category, controlCount: c._count.category }));
  }
}
