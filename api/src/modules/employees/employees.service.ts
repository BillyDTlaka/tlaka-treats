import { PrismaClient } from '@prisma/client'
import { AppError } from '../../shared/errors'

export class EmployeeService {
  constructor(private prisma: PrismaClient) {}

  private employeeInclude = {
    user: { select: { id: true, firstName: true, lastName: true, email: true, phone: true, status: true } },
    qualifications: { orderBy: { createdAt: 'desc' as const } },
    departmentRel: { select: { id: true, name: true } },
    reportsTo: { select: { id: true, jobTitle: true, user: { select: { firstName: true, lastName: true } } } },
    directReports: { select: { id: true, jobTitle: true, user: { select: { firstName: true, lastName: true } } } },
  }

  // ── Employees ────────────────────────────────────────────────────────────────

  async list(status?: string) {
    return this.prisma.employee.findMany({
      where: status ? { status: status as any } : undefined,
      include: this.employeeInclude,
      orderBy: { user: { firstName: 'asc' } },
    })
  }

  async getById(id: string) {
    const emp = await this.prisma.employee.findUnique({
      where: { id },
      include: {
        ...this.employeeInclude,
        shifts: { include: { shift: true }, orderBy: { date: 'desc' }, take: 30 },
        leaveRequests: { orderBy: { createdAt: 'desc' }, take: 20 },
        payrollItems: { include: { payrollRun: true }, orderBy: { payrollRun: { period: 'desc' } }, take: 12 },
      },
    })
    if (!emp) throw new AppError('Employee not found', 404, 'NOT_FOUND')
    return emp
  }

  async create(data: {
    firstName: string
    lastName: string
    email: string
    phone?: string
    password: string
    jobTitle: string
    department?: string
    departmentId?: string
    reportsToId?: string
    employmentType?: string
    startDate: string
    hourlyRate?: number
    monthlyRate?: number
    bio?: string
    bankName?: string
    bankAccount?: string
    bankBranch?: string
    notes?: string
  }) {
    const { firstName, lastName, email, phone, password, ...empData } = data

    // Check if user already exists and is already an employee
    const existingUser = await this.prisma.user.findUnique({ where: { email } })
    if (existingUser) {
      const existingEmp = await this.prisma.employee.findUnique({ where: { userId: existingUser.id } })
      if (existingEmp) throw new AppError('User is already an employee', 409, 'ALREADY_EXISTS')
    }

    const bcrypt = await import('bcryptjs')
    const passwordHash = await bcrypt.hash(password, 10)

    // Generate employee code
    const count = await this.prisma.employee.count()
    const num = count + 1
    const employeeCode = `EMP${num < 10 ? '00' : num < 100 ? '0' : ''}${num}`

    // Find employee role
    const employeeRole = await this.prisma.role.findFirst({ where: { name: 'EMPLOYEE' } })

    return this.prisma.$transaction(async (tx) => {
      let user = existingUser
      if (!user) {
        user = await tx.user.create({
          data: { firstName, lastName, email, phone, passwordHash },
        })
      }
      if (employeeRole) {
        await tx.userRole.upsert({
          where: { userId_roleId: { userId: user.id, roleId: employeeRole.id } },
          create: { userId: user.id, roleId: employeeRole.id },
          update: {},
        })
      }
      return tx.employee.create({
        data: {
          userId: user.id,
          employeeCode,
          jobTitle: empData.jobTitle,
          department: empData.department,
          departmentId: empData.departmentId || null,
          reportsToId: empData.reportsToId || null,
          employmentType: (empData.employmentType as any) || 'FULL_TIME',
          startDate: new Date(empData.startDate),
          hourlyRate: empData.hourlyRate,
          monthlyRate: empData.monthlyRate,
          bio: empData.bio,
          bankName: empData.bankName,
          bankAccount: empData.bankAccount,
          bankBranch: empData.bankBranch,
          notes: empData.notes,
        },
        include: this.employeeInclude,
      })
    })
  }

  async update(id: string, data: Partial<{
    firstName: string
    lastName: string
    email: string
    phone: string
    jobTitle: string
    department: string
    departmentId: string | null
    reportsToId: string | null
    employmentType: string
    startDate: string
    endDate: string
    hourlyRate: number
    monthlyRate: number
    bio: string
    bankName: string
    bankAccount: string
    bankBranch: string
    notes: string
    status: string
  }>) {
    const emp = await this.prisma.employee.findUnique({ where: { id } })
    if (!emp) throw new AppError('Employee not found', 404, 'NOT_FOUND')

    const { firstName, lastName, email, phone, ...empData } = data

    // Update user fields separately to avoid Prisma type conflict between
    // relational (user.update) and scalar FK (departmentId: null) inputs
    if (firstName !== undefined || lastName !== undefined || email !== undefined || phone !== undefined) {
      await this.prisma.user.update({
        where: { id: emp.userId },
        data: {
          ...(firstName !== undefined && { firstName }),
          ...(lastName !== undefined && { lastName }),
          ...(email !== undefined && { email }),
          ...(phone !== undefined && { phone }),
        },
      })
    }

    return this.prisma.employee.update({
      where: { id },
      data: {
        ...empData,
        employmentType: empData.employmentType as any,
        status: empData.status as any,
        startDate: empData.startDate ? new Date(empData.startDate) : undefined,
        endDate: empData.endDate ? new Date(empData.endDate) : undefined,
      },
      include: this.employeeInclude,
    })
  }

  async terminate(id: string) {
    const emp = await this.prisma.employee.findUnique({ where: { id } })
    if (!emp) throw new AppError('Employee not found', 404, 'NOT_FOUND')
    return this.prisma.employee.update({
      where: { id },
      data: { status: 'TERMINATED', endDate: new Date() },
      include: this.employeeInclude,
    })
  }

  // ── Qualifications ───────────────────────────────────────────────────────────

  async addQualification(employeeId: string, data: {
    type: string
    name: string
    issuedBy?: string
    issueDate?: string
    expiryDate?: string
    documentUrl?: string
    notes?: string
  }) {
    const emp = await this.prisma.employee.findUnique({ where: { id: employeeId } })
    if (!emp) throw new AppError('Employee not found', 404, 'NOT_FOUND')

    const expiryDate = data.expiryDate ? new Date(data.expiryDate) : null
    const status = this.computeQualStatus(expiryDate)

    return this.prisma.employeeQualification.create({
      data: {
        employeeId,
        type: data.type as any,
        name: data.name,
        issuedBy: data.issuedBy,
        issueDate: data.issueDate ? new Date(data.issueDate) : null,
        expiryDate,
        documentUrl: data.documentUrl,
        notes: data.notes,
        status,
      },
    })
  }

  async updateQualification(employeeId: string, qualId: string, data: Partial<{
    type: string
    name: string
    issuedBy: string
    issueDate: string
    expiryDate: string
    documentUrl: string
    status: string
    notes: string
  }>) {
    const qual = await this.prisma.employeeQualification.findFirst({
      where: { id: qualId, employeeId },
    })
    if (!qual) throw new AppError('Qualification not found', 404, 'NOT_FOUND')

    const expiryDate = data.expiryDate !== undefined
      ? (data.expiryDate ? new Date(data.expiryDate) : null)
      : qual.expiryDate
    const status = data.status ? (data.status as any) : this.computeQualStatus(expiryDate)

    return this.prisma.employeeQualification.update({
      where: { id: qualId },
      data: {
        ...data,
        type: data.type as any,
        issueDate: data.issueDate ? new Date(data.issueDate) : undefined,
        expiryDate,
        status,
      },
    })
  }

  async deleteQualification(employeeId: string, qualId: string) {
    const qual = await this.prisma.employeeQualification.findFirst({
      where: { id: qualId, employeeId },
    })
    if (!qual) throw new AppError('Qualification not found', 404, 'NOT_FOUND')
    await this.prisma.employeeQualification.delete({ where: { id: qualId } })
  }

  async getExpiringQualifications(withinDays = 30) {
    const threshold = new Date()
    threshold.setDate(threshold.getDate() + withinDays)
    return this.prisma.employeeQualification.findMany({
      where: {
        expiryDate: { not: null, lte: threshold },
        status: { in: ['VALID', 'EXPIRING_SOON'] },
      },
      include: { employee: { include: { user: { select: { firstName: true, lastName: true } } } } },
      orderBy: { expiryDate: 'asc' },
    })
  }

  private computeQualStatus(expiryDate: Date | null): 'VALID' | 'EXPIRING_SOON' | 'EXPIRED' {
    if (!expiryDate) return 'VALID'
    const now = new Date()
    const threshold = new Date()
    threshold.setDate(threshold.getDate() + 30)
    if (expiryDate < now) return 'EXPIRED'
    if (expiryDate <= threshold) return 'EXPIRING_SOON'
    return 'VALID'
  }

  // ── Shifts ───────────────────────────────────────────────────────────────────

  async listShifts() {
    return this.prisma.shift.findMany({ orderBy: { startTime: 'asc' } })
  }

  async createShift(data: { name: string; startTime: string; endTime: string; breakMins?: number }) {
    return this.prisma.shift.create({ data })
  }

  async updateShift(id: string, data: Partial<{ name: string; startTime: string; endTime: string; breakMins: number }>) {
    return this.prisma.shift.update({ where: { id }, data })
  }

  async deleteShift(id: string) {
    await this.prisma.shift.delete({ where: { id } })
  }

  async getSchedule(from: string, to: string, employeeId?: string) {
    return this.prisma.shiftAssignment.findMany({
      where: {
        date: { gte: new Date(from), lte: new Date(to) },
        ...(employeeId ? { employeeId } : {}),
      },
      include: {
        shift: true,
        employee: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: [{ date: 'asc' }, { employee: { user: { firstName: 'asc' } } }],
    })
  }

  async assignShift(data: { employeeId: string; shiftId: string; date: string; notes?: string }) {
    const emp = await this.prisma.employee.findUnique({ where: { id: data.employeeId } })
    if (!emp) throw new AppError('Employee not found', 404, 'NOT_FOUND')
    const shift = await this.prisma.shift.findUnique({ where: { id: data.shiftId } })
    if (!shift) throw new AppError('Shift not found', 404, 'NOT_FOUND')

    return this.prisma.shiftAssignment.upsert({
      where: { employeeId_date: { employeeId: data.employeeId, date: new Date(data.date) } },
      create: {
        employeeId: data.employeeId,
        shiftId: data.shiftId,
        date: new Date(data.date),
        notes: data.notes,
      },
      update: { shiftId: data.shiftId, notes: data.notes },
      include: { shift: true, employee: { include: { user: { select: { firstName: true, lastName: true } } } } },
    })
  }

  async updateAssignment(id: string, data: Partial<{
    status: string
    clockIn: string
    clockOut: string
    hoursWorked: number
    notes: string
  }>) {
    const hoursWorked = data.hoursWorked !== undefined
      ? data.hoursWorked
      : (data.clockIn && data.clockOut ? this.calcHours(data.clockIn, data.clockOut) : undefined)

    return this.prisma.shiftAssignment.update({
      where: { id },
      data: {
        status: data.status as any,
        clockIn: data.clockIn ? new Date(data.clockIn) : undefined,
        clockOut: data.clockOut ? new Date(data.clockOut) : undefined,
        hoursWorked,
        notes: data.notes,
      },
      include: { shift: true },
    })
  }

  async deleteAssignment(id: string) {
    await this.prisma.shiftAssignment.delete({ where: { id } })
  }

  private calcHours(clockIn: string, clockOut: string): number {
    const diff = new Date(clockOut).getTime() - new Date(clockIn).getTime()
    return Math.round((diff / 3600000) * 100) / 100
  }

  // ── Leave ────────────────────────────────────────────────────────────────────

  async listLeave(status?: string) {
    return this.prisma.leaveRequest.findMany({
      where: status ? { status: status as any } : undefined,
      include: {
        employee: { include: { user: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    })
  }

  async createLeave(data: {
    employeeId: string
    type: string
    fromDate: string
    toDate: string
    reason?: string
  }) {
    const from = new Date(data.fromDate)
    const to = new Date(data.toDate)
    const days = Math.ceil((to.getTime() - from.getTime()) / 86400000) + 1

    return this.prisma.leaveRequest.create({
      data: {
        employeeId: data.employeeId,
        type: data.type as any,
        fromDate: from,
        toDate: to,
        days,
        reason: data.reason,
      },
      include: { employee: { include: { user: { select: { firstName: true, lastName: true } } } } },
    })
  }

  async updateLeaveStatus(id: string, status: 'APPROVED' | 'REJECTED' | 'CANCELLED', approverId?: string) {
    const req = await this.prisma.leaveRequest.findUnique({ where: { id } })
    if (!req) throw new AppError('Leave request not found', 404, 'NOT_FOUND')
    return this.prisma.leaveRequest.update({
      where: { id },
      data: { status, approvedBy: approverId },
      include: { employee: { include: { user: { select: { firstName: true, lastName: true } } } } },
    })
  }

  // ── Payroll ──────────────────────────────────────────────────────────────────

  async listPayroll() {
    return this.prisma.payrollRun.findMany({
      include: { items: { include: { employee: { include: { user: { select: { firstName: true, lastName: true } } } } } } },
      orderBy: { period: 'desc' },
    })
  }

  async getPayrollRun(id: string) {
    const run = await this.prisma.payrollRun.findUnique({
      where: { id },
      include: { items: { include: { employee: { include: { user: { select: { firstName: true, lastName: true } } } } } } },
    })
    if (!run) throw new AppError('Payroll run not found', 404, 'NOT_FOUND')
    return run
  }

  async generatePayroll(period: string) {
    const [year, month] = period.split('-').map(Number)
    const from = new Date(year, month - 1, 1)
    const to = new Date(year, month, 0, 23, 59, 59)

    const assignments = await this.prisma.shiftAssignment.findMany({
      where: { date: { gte: from, lte: to }, status: 'COMPLETED', hoursWorked: { not: null } },
      include: { employee: true },
    })

    const byEmployee: Record<string, { emp: any; hours: number }> = {}
    for (const a of assignments) {
      if (!byEmployee[a.employeeId]) byEmployee[a.employeeId] = { emp: a.employee, hours: 0 }
      byEmployee[a.employeeId].hours += Number(a.hoursWorked || 0)
    }

    const items: { employeeId: string; hoursWorked: number; grossPay: number; deductions: number; netPay: number }[] = []

    for (const { emp, hours } of Object.values(byEmployee)) {
      const rate = Number(emp.hourlyRate || 0)
      const gross = Math.round(hours * rate * 100) / 100
      items.push({ employeeId: emp.id, hoursWorked: hours, grossPay: gross, deductions: 0, netPay: gross })
    }

    // Salaried employees not already counted
    const salaried = await this.prisma.employee.findMany({
      where: { status: 'ACTIVE', monthlyRate: { not: null }, hourlyRate: null },
    })
    for (const emp of salaried) {
      if (!byEmployee[emp.id]) {
        const gross = Number(emp.monthlyRate || 0)
        items.push({ employeeId: emp.id, hoursWorked: 0, grossPay: gross, deductions: 0, netPay: gross })
      }
    }

    const totalGross = items.reduce((s, i) => s + i.grossPay, 0)
    const totalNet   = items.reduce((s, i) => s + i.netPay, 0)

    return this.prisma.payrollRun.create({
      data: { period, totalGross, totalNet, items: { create: items } },
      include: { items: { include: { employee: { include: { user: { select: { firstName: true, lastName: true } } } } } } },
    })
  }

  async approvePayroll(id: string) {
    return this.prisma.payrollRun.update({ where: { id }, data: { status: 'APPROVED' } })
  }

  async processPayroll(id: string, wagesAccountId?: string) {
    const run = await this.getPayrollRun(id)
    if (run.status !== 'APPROVED') throw new AppError('Payroll must be APPROVED before processing', 400, 'INVALID_STATE')

    const itemCount = run.items.length
    const finTx = await this.prisma.financeTransaction.create({
      data: {
        type: 'EXPENSE',
        category: 'Staff Wages',
        amount: run.totalNet,
        description: `Payroll ${run.period} — ${itemCount} employee${itemCount !== 1 ? 's' : ''}`,
        reference: run.id,
        accountId: wagesAccountId || null,
        date: new Date(),
      },
    })

    return this.prisma.payrollRun.update({
      where: { id },
      data: { status: 'PAID', processedAt: new Date(), financeTransactionId: finTx.id },
    })
  }

  // ── Contracts ─────────────────────────────────────────────────────────────────

  async listContracts(employeeId?: string) {
    return this.prisma.employeeContract.findMany({
      where: employeeId ? { employeeId } : undefined,
      include: { employee: { include: { user: { select: { firstName: true, lastName: true } } } } },
      orderBy: { startDate: 'desc' },
    })
  }

  async createContract(employeeId: string, data: {
    contractType: string
    title: string
    startDate: string
    endDate?: string
    grossSalary?: number
    hourlyRate?: number
    hoursPerWeek?: number
    documentUrl?: string
    notes?: string
  }) {
    // Auto-expire previous active contracts of same type
    await this.prisma.employeeContract.updateMany({
      where: { employeeId, status: 'ACTIVE' },
      data: { status: 'EXPIRED' },
    })
    return this.prisma.employeeContract.create({
      data: {
        employeeId,
        contractType: data.contractType as any,
        title: data.title,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : null,
        grossSalary: data.grossSalary ?? null,
        hourlyRate: data.hourlyRate ?? null,
        hoursPerWeek: data.hoursPerWeek ?? null,
        documentUrl: data.documentUrl ?? null,
        notes: data.notes ?? null,
        status: 'ACTIVE',
      },
      include: { employee: { include: { user: { select: { firstName: true, lastName: true } } } } },
    })
  }

  async updateContract(id: string, data: Partial<{
    contractType: string
    title: string
    startDate: string
    endDate: string | null
    grossSalary: number | null
    hourlyRate: number | null
    hoursPerWeek: number | null
    status: string
    documentUrl: string | null
    notes: string | null
  }>) {
    return this.prisma.employeeContract.update({
      where: { id },
      data: {
        ...(data.contractType && { contractType: data.contractType as any }),
        ...(data.title && { title: data.title }),
        ...(data.startDate && { startDate: new Date(data.startDate) }),
        ...(data.endDate !== undefined && { endDate: data.endDate ? new Date(data.endDate) : null }),
        ...(data.grossSalary !== undefined && { grossSalary: data.grossSalary }),
        ...(data.hourlyRate !== undefined && { hourlyRate: data.hourlyRate }),
        ...(data.hoursPerWeek !== undefined && { hoursPerWeek: data.hoursPerWeek }),
        ...(data.status && { status: data.status as any }),
        ...(data.documentUrl !== undefined && { documentUrl: data.documentUrl }),
        ...(data.notes !== undefined && { notes: data.notes }),
      },
      include: { employee: { include: { user: { select: { firstName: true, lastName: true } } } } },
    })
  }

  async deleteContract(id: string) {
    return this.prisma.employeeContract.delete({ where: { id } })
  }

  // ── Timesheets ────────────────────────────────────────────────────────────────

  private getWeekBounds(weekStart: string) {
    const ws = new Date(weekStart)
    const we = new Date(ws)
    we.setDate(ws.getDate() + 6)
    return { ws, we }
  }

  async listTimesheets(filters: { employeeId?: string; status?: string; weekStart?: string }) {
    return this.prisma.timesheet.findMany({
      where: {
        ...(filters.employeeId && { employeeId: filters.employeeId }),
        ...(filters.status && { status: filters.status as any }),
        ...(filters.weekStart && { weekStart: new Date(filters.weekStart) }),
      },
      include: {
        employee: { include: { user: { select: { firstName: true, lastName: true } } } },
        entries: { orderBy: { date: 'asc' } },
      },
      orderBy: { weekStart: 'desc' },
    })
  }

  async getTimesheet(id: string) {
    const ts = await this.prisma.timesheet.findUnique({
      where: { id },
      include: {
        employee: { include: { user: { select: { firstName: true, lastName: true } } } },
        entries: { orderBy: { date: 'asc' } },
      },
    })
    if (!ts) throw new AppError('Timesheet not found', 404, 'NOT_FOUND')
    return ts
  }

  async getOrCreateTimesheet(employeeId: string, weekStart: string) {
    const { ws, we } = this.getWeekBounds(weekStart)
    const existing = await this.prisma.timesheet.findUnique({
      where: { employeeId_weekStart: { employeeId, weekStart: ws } },
      include: { employee: { include: { user: { select: { firstName: true, lastName: true } } } }, entries: { orderBy: { date: 'asc' } } },
    })
    if (existing) return existing

    // Auto-populate from completed shift assignments for that week
    const assignments = await this.prisma.shiftAssignment.findMany({
      where: { employeeId, date: { gte: ws, lte: we }, status: { in: ['COMPLETED', 'SCHEDULED'] } },
      include: { shift: true },
    })

    const entries = assignments.map(a => {
      const hours = Number(a.hoursWorked || 0) || this.calcHoursFromShift(a.shift)
      return {
        date: a.date,
        hoursWorked: hours,
        startTime: a.shift?.startTime ?? null,
        endTime: a.shift?.endTime ?? null,
        breakMins: a.shift?.breakMins ?? 0,
        shiftAssignmentId: a.id,
        description: a.shift?.name ?? null,
      }
    })

    const totalHours = entries.reduce((s, e) => s + e.hoursWorked, 0)

    return this.prisma.timesheet.create({
      data: {
        employeeId,
        weekStart: ws,
        weekEnd: we,
        totalHours,
        entries: { create: entries },
      },
      include: {
        employee: { include: { user: { select: { firstName: true, lastName: true } } } },
        entries: { orderBy: { date: 'asc' } },
      },
    })
  }

  private calcHoursFromShift(shift: { startTime: string; endTime: string; breakMins: number } | null) {
    if (!shift) return 0
    const [sh, sm] = shift.startTime.split(':').map(Number)
    const [eh, em] = shift.endTime.split(':').map(Number)
    const mins = (eh * 60 + em) - (sh * 60 + sm) - (shift.breakMins || 0)
    return Math.max(0, Math.round(mins / 60 * 100) / 100)
  }

  async upsertTimesheetEntry(timesheetId: string, data: {
    date: string
    hoursWorked: number
    startTime?: string
    endTime?: string
    breakMins?: number
    description?: string
  }) {
    const ts = await this.prisma.timesheet.findUnique({ where: { id: timesheetId } })
    if (!ts) throw new AppError('Timesheet not found', 404, 'NOT_FOUND')
    if (ts.status === 'APPROVED') throw new AppError('Cannot edit an approved timesheet', 400, 'INVALID_STATE')

    const date = new Date(data.date)
    await this.prisma.timesheetEntry.upsert({
      where: { timesheetId_date: { timesheetId, date } },
      create: { timesheetId, date, hoursWorked: data.hoursWorked, startTime: data.startTime, endTime: data.endTime, breakMins: data.breakMins ?? 0, description: data.description },
      update: { hoursWorked: data.hoursWorked, startTime: data.startTime, endTime: data.endTime, breakMins: data.breakMins ?? 0, description: data.description },
    })

    // Recalculate total
    const entries = await this.prisma.timesheetEntry.findMany({ where: { timesheetId } })
    const totalHours = entries.reduce((s, e) => s + Number(e.hoursWorked), 0)
    return this.prisma.timesheet.update({
      where: { id: timesheetId },
      data: { totalHours },
      include: { employee: { include: { user: { select: { firstName: true, lastName: true } } } }, entries: { orderBy: { date: 'asc' } } },
    })
  }

  async submitTimesheet(id: string) {
    const ts = await this.prisma.timesheet.findUnique({ where: { id } })
    if (!ts) throw new AppError('Timesheet not found', 404, 'NOT_FOUND')
    if (ts.status !== 'DRAFT') throw new AppError('Only DRAFT timesheets can be submitted', 400, 'INVALID_STATE')
    return this.prisma.timesheet.update({ where: { id }, data: { status: 'SUBMITTED', submittedAt: new Date() } })
  }

  async approveTimesheet(id: string, approverId: string) {
    const ts = await this.prisma.timesheet.findUnique({ where: { id } })
    if (!ts) throw new AppError('Timesheet not found', 404, 'NOT_FOUND')
    if (ts.status !== 'SUBMITTED') throw new AppError('Only SUBMITTED timesheets can be approved', 400, 'INVALID_STATE')
    return this.prisma.timesheet.update({ where: { id }, data: { status: 'APPROVED', approvedAt: new Date(), approvedBy: approverId } })
  }

  async rejectTimesheet(id: string) {
    const ts = await this.prisma.timesheet.findUnique({ where: { id } })
    if (!ts) throw new AppError('Timesheet not found', 404, 'NOT_FOUND')
    if (ts.status !== 'SUBMITTED') throw new AppError('Only SUBMITTED timesheets can be rejected', 400, 'INVALID_STATE')
    return this.prisma.timesheet.update({ where: { id }, data: { status: 'DRAFT' } })
  }

  // Updated generatePayroll: prefers approved timesheets, falls back to shift assignments
  async generatePayrollFromTimesheets(period: string) {
    const [year, month] = period.split('-').map(Number)
    const from = new Date(year, month - 1, 1)
    const to = new Date(year, month, 0)

    // Get approved timesheets that overlap this period
    const timesheets = await this.prisma.timesheet.findMany({
      where: {
        status: 'APPROVED',
        weekStart: { lte: to },
        weekEnd: { gte: from },
      },
      include: { employee: true, entries: true },
    })

    const byEmployee: Record<string, { emp: any; hours: number }> = {}
    for (const ts of timesheets) {
      // Only count entries within the period
      for (const entry of ts.entries) {
        const d = new Date(entry.date)
        if (d < from || d > to) continue
        if (!byEmployee[ts.employeeId]) byEmployee[ts.employeeId] = { emp: ts.employee, hours: 0 }
        byEmployee[ts.employeeId].hours += Number(entry.hoursWorked)
      }
    }

    // Fallback: completed shifts for employees without approved timesheets
    const assignments = await this.prisma.shiftAssignment.findMany({
      where: { date: { gte: from, lte: to }, status: 'COMPLETED', hoursWorked: { not: null } },
      include: { employee: true },
    })
    for (const a of assignments) {
      if (byEmployee[a.employeeId]) continue // already covered by timesheet
      if (!byEmployee[a.employeeId]) byEmployee[a.employeeId] = { emp: a.employee, hours: 0 }
      byEmployee[a.employeeId].hours += Number(a.hoursWorked || 0)
    }

    const items: { employeeId: string; hoursWorked: number; grossPay: number; deductions: number; netPay: number }[] = []

    for (const { emp, hours } of Object.values(byEmployee)) {
      const rate = Number(emp.hourlyRate || 0)
      const gross = Math.round(hours * rate * 100) / 100
      if (gross > 0) items.push({ employeeId: emp.id, hoursWorked: hours, grossPay: gross, deductions: 0, netPay: gross })
    }

    // Salaried employees
    const salaried = await this.prisma.employee.findMany({
      where: { status: 'ACTIVE', monthlyRate: { not: null }, hourlyRate: null },
    })
    for (const emp of salaried) {
      if (!byEmployee[emp.id]) {
        const gross = Number(emp.monthlyRate || 0)
        items.push({ employeeId: emp.id, hoursWorked: 0, grossPay: gross, deductions: 0, netPay: gross })
      }
    }

    const totalGross = items.reduce((s, i) => s + i.grossPay, 0)
    const totalNet   = items.reduce((s, i) => s + i.netPay, 0)

    return this.prisma.payrollRun.create({
      data: { period, totalGross, totalNet, items: { create: items } },
      include: { items: { include: { employee: { include: { user: { select: { firstName: true, lastName: true } } } } } } },
    })
  }
}
