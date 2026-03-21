import { FastifyPluginAsync } from 'fastify'
import { authenticate, authorize } from '../../shared/middleware/auth'
import { EmployeeService } from './employees.service'

const employeeRoutes: FastifyPluginAsync = async (fastify) => {
  const svc = new EmployeeService(fastify.prisma)

  // ── Employees ──────────────────────────────────────────────────────────────

  fastify.get('/', { preHandler: [authenticate] }, async (req) => {
    const { status } = req.query as { status?: string }
    return svc.list(status)
  })

  fastify.post('/', { preHandler: [authenticate, authorize('manage', 'employee')] }, async (req, reply) => {
    const body = req.body as any
    const emp = await svc.create(body)
    return reply.code(201).send(emp)
  })

  fastify.get('/qualifications/expiring', { preHandler: [authenticate] }, async (req) => {
    const { days } = req.query as { days?: string }
    return svc.getExpiringQualifications(days ? Number(days) : 30)
  })

  fastify.get('/:id', { preHandler: [authenticate] }, async (req) => {
    const { id } = req.params as { id: string }
    return svc.getById(id)
  })

  fastify.patch('/:id', { preHandler: [authenticate, authorize('manage', 'employee')] }, async (req) => {
    const { id } = req.params as { id: string }
    return svc.update(id, req.body as any)
  })

  fastify.post('/:id/terminate', { preHandler: [authenticate, authorize('manage', 'employee')] }, async (req) => {
    const { id } = req.params as { id: string }
    return svc.terminate(id)
  })

  // ── Qualifications ─────────────────────────────────────────────────────────

  fastify.post('/:id/qualifications', { preHandler: [authenticate, authorize('manage', 'employee')] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const qual = await svc.addQualification(id, req.body as any)
    return reply.code(201).send(qual)
  })

  fastify.patch('/:id/qualifications/:qid', { preHandler: [authenticate, authorize('manage', 'employee')] }, async (req) => {
    const { id, qid } = req.params as { id: string; qid: string }
    return svc.updateQualification(id, qid, req.body as any)
  })

  fastify.delete('/:id/qualifications/:qid', { preHandler: [authenticate, authorize('manage', 'employee')] }, async (req, reply) => {
    const { id, qid } = req.params as { id: string; qid: string }
    await svc.deleteQualification(id, qid)
    return reply.code(204).send()
  })

  // ── Shifts ─────────────────────────────────────────────────────────────────

  fastify.get('/shifts/templates', { preHandler: [authenticate] }, async () => svc.listShifts())

  fastify.post('/shifts/templates', { preHandler: [authenticate, authorize('manage', 'employee')] }, async (req, reply) => {
    const shift = await svc.createShift(req.body as any)
    return reply.code(201).send(shift)
  })

  fastify.patch('/shifts/templates/:id', { preHandler: [authenticate, authorize('manage', 'employee')] }, async (req) => {
    const { id } = req.params as { id: string }
    return svc.updateShift(id, req.body as any)
  })

  fastify.delete('/shifts/templates/:id', { preHandler: [authenticate, authorize('manage', 'employee')] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    await svc.deleteShift(id)
    return reply.code(204).send()
  })

  fastify.get('/schedule', { preHandler: [authenticate] }, async (req) => {
    const { from, to, employeeId } = req.query as { from: string; to: string; employeeId?: string }
    return svc.getSchedule(from, to, employeeId)
  })

  fastify.post('/schedule', { preHandler: [authenticate, authorize('manage', 'employee')] }, async (req, reply) => {
    const assignment = await svc.assignShift(req.body as any)
    return reply.code(201).send(assignment)
  })

  fastify.patch('/schedule/:id', { preHandler: [authenticate, authorize('manage', 'employee')] }, async (req) => {
    const { id } = req.params as { id: string }
    return svc.updateAssignment(id, req.body as any)
  })

  fastify.delete('/schedule/:id', { preHandler: [authenticate, authorize('manage', 'employee')] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    await svc.deleteAssignment(id)
    return reply.code(204).send()
  })

  // ── Leave ──────────────────────────────────────────────────────────────────

  fastify.get('/leave', { preHandler: [authenticate] }, async (req) => {
    const { status } = req.query as { status?: string }
    return svc.listLeave(status)
  })

  fastify.post('/leave', { preHandler: [authenticate] }, async (req, reply) => {
    const leave = await svc.createLeave(req.body as any)
    return reply.code(201).send(leave)
  })

  fastify.patch('/leave/:id/approve', { preHandler: [authenticate, authorize('manage', 'employee')] }, async (req) => {
    const { id } = req.params as { id: string }
    const user = (req as any).user
    return svc.updateLeaveStatus(id, 'APPROVED', user?.id)
  })

  fastify.patch('/leave/:id/reject', { preHandler: [authenticate, authorize('manage', 'employee')] }, async (req) => {
    const { id } = req.params as { id: string }
    return svc.updateLeaveStatus(id, 'REJECTED')
  })

  fastify.patch('/leave/:id/cancel', { preHandler: [authenticate] }, async (req) => {
    const { id } = req.params as { id: string }
    return svc.updateLeaveStatus(id, 'CANCELLED')
  })

  // ── Payroll ────────────────────────────────────────────────────────────────

  fastify.get('/payroll', { preHandler: [authenticate, authorize('manage', 'employee')] }, async () => svc.listPayroll())

  fastify.post('/payroll', { preHandler: [authenticate, authorize('manage', 'employee')] }, async (req, reply) => {
    const { period } = req.body as { period: string }
    const run = await svc.generatePayrollFromTimesheets(period)
    return reply.code(201).send(run)
  })

  fastify.get('/payroll/:id', { preHandler: [authenticate, authorize('manage', 'employee')] }, async (req) => {
    const { id } = req.params as { id: string }
    return svc.getPayrollRun(id)
  })

  fastify.patch('/payroll/:id/approve', { preHandler: [authenticate, authorize('manage', 'employee')] }, async (req) => {
    const { id } = req.params as { id: string }
    return svc.approvePayroll(id)
  })

  fastify.post('/payroll/:id/process', { preHandler: [authenticate, authorize('manage', 'employee')] }, async (req) => {
    const { id } = req.params as { id: string }
    const { wagesAccountId } = (req.body as any) || {}
    return svc.processPayroll(id, wagesAccountId)
  })

  // ── Contracts ────────────────────────────────────────────────────────────────

  fastify.get('/contracts', { preHandler: [authenticate] }, async (req) => {
    const { employeeId } = req.query as { employeeId?: string }
    return svc.listContracts(employeeId)
  })

  fastify.post('/:id/contracts', { preHandler: [authenticate, authorize('manage', 'employee')] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    const contract = await svc.createContract(id, req.body as any)
    return reply.code(201).send(contract)
  })

  fastify.patch('/contracts/:id', { preHandler: [authenticate, authorize('manage', 'employee')] }, async (req) => {
    const { id } = req.params as { id: string }
    return svc.updateContract(id, req.body as any)
  })

  fastify.delete('/contracts/:id', { preHandler: [authenticate, authorize('manage', 'employee')] }, async (req, reply) => {
    const { id } = req.params as { id: string }
    await svc.deleteContract(id)
    return reply.code(204).send()
  })

  // ── Timesheets ───────────────────────────────────────────────────────────────

  fastify.get('/timesheets', { preHandler: [authenticate] }, async (req) => {
    const { employeeId, status, weekStart } = req.query as { employeeId?: string; status?: string; weekStart?: string }
    return svc.listTimesheets({ employeeId, status, weekStart })
  })

  fastify.post('/timesheets', { preHandler: [authenticate] }, async (req, reply) => {
    const { employeeId, weekStart } = req.body as { employeeId: string; weekStart: string }
    const ts = await svc.getOrCreateTimesheet(employeeId, weekStart)
    return reply.code(201).send(ts)
  })

  fastify.get('/timesheets/:id', { preHandler: [authenticate] }, async (req) => {
    const { id } = req.params as { id: string }
    return svc.getTimesheet(id)
  })

  fastify.post('/timesheets/:id/entries', { preHandler: [authenticate] }, async (req) => {
    const { id } = req.params as { id: string }
    return svc.upsertTimesheetEntry(id, req.body as any)
  })

  fastify.post('/timesheets/:id/submit', { preHandler: [authenticate] }, async (req) => {
    const { id } = req.params as { id: string }
    return svc.submitTimesheet(id)
  })

  fastify.post('/timesheets/:id/approve', { preHandler: [authenticate, authorize('manage', 'employee')] }, async (req) => {
    const { id } = req.params as { id: string }
    const user = (req as any).user
    return svc.approveTimesheet(id, user?.id)
  })

  fastify.post('/timesheets/:id/reject', { preHandler: [authenticate, authorize('manage', 'employee')] }, async (req) => {
    const { id } = req.params as { id: string }
    return svc.rejectTimesheet(id)
  })
}

export default employeeRoutes
