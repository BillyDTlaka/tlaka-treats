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
}
