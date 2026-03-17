import { PrismaClient } from '@prisma/client'
import { AppError } from '../../shared/errors'

export class TaskService {
  constructor(private prisma: PrismaClient) {}

  async list(filters?: { status?: string; priority?: string }) {
    return this.prisma.task.findMany({
      where: {
        ...(filters?.status   ? { status:   filters.status   as any } : {}),
        ...(filters?.priority ? { priority: filters.priority as any } : {}),
      },
      orderBy: [
        { status: 'asc' },
        { priority: 'asc' },
        { createdAt: 'desc' },
      ],
    })
  }

  async getById(id: string) {
    const task = await this.prisma.task.findUnique({ where: { id } })
    if (!task) throw new AppError('Task not found', 404, 'NOT_FOUND')
    return task
  }

  async create(data: {
    title: string
    description?: string
    priority?: string
    dueDate?: string
    owner?: string
    source?: string
    sourceId?: string
  }) {
    return this.prisma.task.create({
      data: {
        title:       data.title,
        description: data.description,
        priority:    (data.priority as any) || 'MEDIUM',
        dueDate:     data.dueDate ? new Date(data.dueDate) : null,
        owner:       data.owner,
        source:      (data.source as any) || 'MANUAL',
        sourceId:    data.sourceId,
      },
    })
  }

  async update(id: string, data: Partial<{
    title: string
    description: string
    priority: string
    status: string
    dueDate: string
    owner: string
  }>) {
    const task = await this.prisma.task.findUnique({ where: { id } })
    if (!task) throw new AppError('Task not found', 404, 'NOT_FOUND')
    return this.prisma.task.update({
      where: { id },
      data: {
        ...data,
        priority: data.priority as any,
        status:   data.status   as any,
        dueDate:  data.dueDate  ? new Date(data.dueDate) : undefined,
      },
    })
  }

  async delete(id: string) {
    const task = await this.prisma.task.findUnique({ where: { id } })
    if (!task) throw new AppError('Task not found', 404, 'NOT_FOUND')
    await this.prisma.task.delete({ where: { id } })
  }

  async createFromBoardMeeting(meetingId: string) {
    const meeting = await (this.prisma as any).boardMeeting.findUnique({ where: { id: meetingId } })
    if (!meeting) throw new AppError('Board meeting not found', 404, 'NOT_FOUND')

    const report = meeting.reportJson as any
    const actions: any[] = report?.recommendedActions || []
    if (!actions.length) throw new AppError('No recommended actions found in this meeting', 400, 'NO_ACTIONS')

    const priorityMap: Record<string, string> = { HIGH: 'HIGH', MEDIUM: 'MEDIUM', LOW: 'LOW' }
    const tasks = await Promise.all(
      actions.map((a: any) =>
        this.prisma.task.create({
          data: {
            title:       a.action || 'Board recommendation',
            description: `Expected impact: ${a.expectedImpact || '—'}\nTimeframe: ${a.timeframe || '—'}\nConsensus: ${a.advisorConsensus || '—'}`,
            priority:    (priorityMap[a.priority] as any) || 'MEDIUM',
            owner:       a.owner || undefined,
            source:      'BOARD_MEETING',
            sourceId:    meetingId,
          },
        })
      )
    )
    return { created: tasks.length, tasks }
  }

  async counts() {
    const [open, inProgress, done] = await Promise.all([
      this.prisma.task.count({ where: { status: 'OPEN' } }),
      this.prisma.task.count({ where: { status: 'IN_PROGRESS' } }),
      this.prisma.task.count({ where: { status: 'DONE' } }),
    ])
    return { open, inProgress, done, total: open + inProgress + done }
  }
}
