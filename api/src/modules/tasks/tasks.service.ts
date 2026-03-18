import { PrismaClient } from '@prisma/client'
import { AppError } from '../../shared/errors'

const EMPLOYEE_SELECT = {
  id: true,
  jobTitle: true,
  user: { select: { firstName: true, lastName: true } },
}

export class TaskService {
  constructor(private prisma: PrismaClient) {}

  async list(filters?: { status?: string; priority?: string; strategyId?: string }) {
    return this.prisma.task.findMany({
      where: {
        ...(filters?.status     ? { status:     filters.status     as any } : {}),
        ...(filters?.priority   ? { priority:   filters.priority   as any } : {}),
        ...(filters?.strategyId ? { strategyId: filters.strategyId }        : {}),
      },
      include: { employee: { select: EMPLOYEE_SELECT } },
      orderBy: [
        { status: 'asc' },
        { priority: 'asc' },
        { createdAt: 'desc' },
      ],
    })
  }

  async getById(id: string) {
    const task = await this.prisma.task.findUnique({
      where: { id },
      include: { employee: { select: EMPLOYEE_SELECT } },
    })
    if (!task) throw new AppError('Task not found', 404, 'NOT_FOUND')
    return task
  }

  async create(data: {
    title: string
    description?: string
    priority?: string
    dueDate?: string
    owner?: string
    employeeId?: string
    strategyId?: string
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
        employeeId:  data.employeeId || null,
        strategyId:  data.strategyId || null,
        source:      (data.source as any) || 'MANUAL',
        sourceId:    data.sourceId,
      },
      include: { employee: { select: EMPLOYEE_SELECT } },
    })
  }

  async update(id: string, data: Partial<{
    title: string
    description: string
    priority: string
    status: string
    dueDate: string
    owner: string
    employeeId: string | null
  }>) {
    const task = await this.prisma.task.findUnique({ where: { id } })
    if (!task) throw new AppError('Task not found', 404, 'NOT_FOUND')
    return this.prisma.task.update({
      where: { id },
      data: {
        ...(data.title       !== undefined ? { title:       data.title }                      : {}),
        ...(data.description !== undefined ? { description: data.description }                : {}),
        ...(data.priority    !== undefined ? { priority:    data.priority as any }            : {}),
        ...(data.status      !== undefined ? { status:      data.status   as any }            : {}),
        ...(data.dueDate     !== undefined ? { dueDate:     data.dueDate ? new Date(data.dueDate) : null } : {}),
        ...(data.owner       !== undefined ? { owner:       data.owner }                      : {}),
        ...(data.employeeId  !== undefined ? { employeeId:  data.employeeId }                 : {}),
      },
      include: { employee: { select: EMPLOYEE_SELECT } },
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
          include: { employee: { select: EMPLOYEE_SELECT } },
        })
      )
    )
    return { created: tasks.length, tasks }
  }

  async createFromStrategy(
    strategyId: string,
    actions: { title: string; description?: string; week?: string; employeeId?: string }[]
  ) {
    const tasks = await Promise.all(
      actions.map(a =>
        this.prisma.task.create({
          data: {
            title:       a.title,
            description: a.description,
            priority:    'MEDIUM',
            owner:       a.week || undefined,
            employeeId:  a.employeeId || null,
            strategyId,
            source:      'STRATEGY',
            sourceId:    strategyId,
          },
          include: { employee: { select: EMPLOYEE_SELECT } },
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
