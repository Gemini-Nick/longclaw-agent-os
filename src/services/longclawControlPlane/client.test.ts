import { describe, expect, it } from 'vitest'

import { LongclawControlPlaneClient } from './client.js'

describe('LongclawControlPlaneClient simulated WeClaw to client flow', () => {
  it('launches through Hermes and exposes mode-aware task/run/work item shape consumed by Electron', async () => {
    const requests: Array<{ url: string; method: string; body?: Record<string, unknown> }> = []
    const fetchImpl: typeof fetch = async (input, init) => {
      const url = String(input)
      const method = String(init?.method ?? 'GET')
      const body =
        typeof init?.body === 'string' ? (JSON.parse(init.body) as Record<string, unknown>) : undefined
      requests.push({ url, method, body })

      if (url.endsWith('/agent-os/launches') && method === 'POST') {
        return new Response(
          JSON.stringify({
            launch_id: 'launch-1',
            pack_id: 'due_diligence',
            task: {
              task_id: 'task-1',
              capability: 'due_diligence.company_due_diligence',
              channel: 'wechat',
              status: 'succeeded',
              work_mode: 'weclaw_dispatch',
              origin_surface: 'wechat_thread',
              interaction_surface: 'weclaw',
              runtime_profile: 'dev_local_acp_bridge',
              runtime_target: 'local_runtime',
              model_plane: 'cloud_provider',
              execution_plane: 'local_executor',
              input: {
                query: '调查这家公司',
                raw_text: '@pack due_diligence.company_due_diligence 调查这家公司',
                requested_outcome: '调查这家公司',
              },
              run_ids: ['run-1'],
              last_run_id: 'run-1',
              created_at: '2026-04-19T09:00:00Z',
              updated_at: '2026-04-19T09:01:00Z',
              metadata: {
                pack_id: 'due_diligence',
                launch_source: 'weclaw',
                runtime_profile: 'dev_local_acp_bridge',
              },
            },
            run: {
              run_id: 'run-1',
              domain: 'due_diligence',
              capability: 'company_due_diligence',
              status: 'succeeded',
              session_id: 'session:user-1',
              task_id: 'task-1',
              summary: 'due diligence completed',
              created_at: '2026-04-19T09:00:00Z',
              started_at: '2026-04-19T09:00:01Z',
              finished_at: '2026-04-19T09:01:00Z',
              metadata: {
                pack_id: 'due_diligence',
                work_mode: 'weclaw_dispatch',
                origin_surface: 'wechat_thread',
                interaction_surface: 'weclaw',
                runtime_profile: 'dev_local_acp_bridge',
                runtime_target: 'local_runtime',
                model_plane: 'cloud_provider',
                execution_plane: 'local_executor',
              },
              pack_id: 'due_diligence',
            },
            artifacts: [],
            review_actions: [],
            work_items: [
              {
                work_item_id: 'work-1',
                pack_id: 'due_diligence',
                kind: 'manual_review',
                title: 'Review delivery bundle',
                summary: 'Evidence bundle ready for operator review',
                severity: 'warning',
                status: 'open',
                run_id: 'run-1',
                artifact_refs: [],
                operator_actions: [],
                created_at: '2026-04-19T09:01:00Z',
                updated_at: '2026-04-19T09:01:00Z',
                metadata: {
                  work_mode: 'weclaw_dispatch',
                  origin_surface: 'wechat_thread',
                  interaction_surface: 'weclaw',
                  runtime_profile: 'dev_local_acp_bridge',
                  runtime_target: 'local_runtime',
                  model_plane: 'cloud_provider',
                  execution_plane: 'local_executor',
                },
              },
            ],
            compiled_input: {
              query: '调查这家公司',
            },
            metadata: {
              launch_source: 'weclaw',
            },
          }),
          { status: 202, headers: { 'Content-Type': 'application/json' } },
        )
      }

      if (url.endsWith('/agent-os/tasks?limit=5')) {
        return new Response(
          JSON.stringify([
            {
              task_id: 'task-1',
              capability: 'due_diligence.company_due_diligence',
              channel: 'wechat',
              status: 'succeeded',
              input: {
                query: '调查这家公司',
              },
              run_ids: ['run-1'],
              last_run_id: 'run-1',
              created_at: '2026-04-19T09:00:00Z',
              updated_at: '2026-04-19T09:01:00Z',
              metadata: {
                pack_id: 'due_diligence',
                work_mode: 'weclaw_dispatch',
                origin_surface: 'wechat_thread',
                interaction_surface: 'weclaw',
                runtime_profile: 'dev_local_acp_bridge',
                runtime_target: 'local_runtime',
                model_plane: 'cloud_provider',
                execution_plane: 'local_executor',
              },
            },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      if (url.endsWith('/agent-os/overview')) {
        return new Response(
          JSON.stringify({
            packs: [
              {
                pack_id: 'due_diligence',
                domain: 'due_diligence',
                version: '0.1.0',
                owner_repo: 'due-diligence-core',
                runtime: 'cloud',
                description: 'Due diligence pack',
                metadata: {},
              },
            ],
            adapters: [
              {
                adapter_id: 'weclaw',
                channel: 'wechat',
                owner_repo: 'weclaw',
                description: 'remote cowork companion',
                metadata: {},
              },
            ],
            packHealth: [],
            adapterHealth: [
              {
                adapter_id: 'weclaw',
                channel: 'wechat',
                status: 'ok',
                last_ingest_at: '2026-04-19T09:00:00Z',
                last_delivery_at: '2026-04-19T09:01:00Z',
                notes: [],
              },
            ],
            mode_summary: {
              tasks: { weclaw_dispatch: 1 },
              runs: { weclaw_dispatch: 1 },
              work_items: { weclaw_dispatch: 1 },
            },
            runs_summary: {
              total: 1,
              by_status: { succeeded: 1 },
              running: 0,
              failed: 0,
              partial: 0,
              succeeded: 1,
            },
            work_items_summary: {
              total: 1,
              open: 1,
              critical: 0,
              warning: 1,
              info: 0,
            },
            recent_failures: [],
            memoryTargets: {
              raw: 'mempalace://raw',
              reviewed: 'obsidian://reviewed',
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      if (url.endsWith('/agent-os/work-items')) {
        return new Response(
          JSON.stringify([
            {
              work_item_id: 'work-1',
              pack_id: 'due_diligence',
              kind: 'manual_review',
              title: 'Review delivery bundle',
              summary: 'Evidence bundle ready for operator review',
              severity: 'warning',
              status: 'open',
              run_id: 'run-1',
              artifact_refs: [],
              operator_actions: [],
              created_at: '2026-04-19T09:01:00Z',
              updated_at: '2026-04-19T09:01:00Z',
              metadata: {
                work_mode: 'weclaw_dispatch',
                origin_surface: 'wechat_thread',
                interaction_surface: 'weclaw',
                runtime_profile: 'dev_local_acp_bridge',
                runtime_target: 'local_runtime',
                model_plane: 'cloud_provider',
                execution_plane: 'local_executor',
              },
            },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      if (url.endsWith('/agent-os/packs/due_diligence/dashboard')) {
        return new Response(
          JSON.stringify({
            pack_id: 'due_diligence',
            title: 'Due Diligence',
            recent_runs: [],
            manual_review_queue: [],
            repair_cases: [],
            site_health: [],
            operator_actions: [],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      throw new Error(`Unexpected request: ${method} ${url}`)
    }

    const client = new LongclawControlPlaneClient({
      hermesAgentOsBaseUrl: 'http://hermes.local',
      hermesApiKey: 'test-token',
      fetchImpl,
    })

    const receipt = await client.launch({
      source: 'weclaw',
      raw_text: '@pack due_diligence.company_due_diligence 调查这家公司',
      mentions: [{ kind: 'pack', value: 'due_diligence.company_due_diligence', metadata: {} }],
      requested_outcome: '调查这家公司',
      work_mode: 'weclaw_dispatch',
      launch_surface: 'wechat_thread',
      interaction_surface: 'weclaw',
      runtime_profile: 'dev_local_acp_bridge',
      runtime_target: 'local_runtime',
      model_plane: 'cloud_provider',
      workspace_target: 'conversation:user-1',
      session_context: {
        channel: 'wechat',
        user_id: 'user-1',
      },
      delivery_preference: {
        policy_id: 'weclaw_front_door',
        preferred_channels: ['wechat'],
        fallback_channels: ['desktop'],
        windowed_proactive: true,
        desktop_fallback: true,
        requires_approval: false,
        metadata: {},
      },
      metadata: {},
    })

    const tasks = await client.listTasks(5)
    const overview = await client.getOverview()
    const workItems = await client.listWorkItems()
    const dashboard = await client.getPackDashboard('due_diligence')

    expect(receipt.pack_id).toBe('due_diligence')
    expect(receipt.task.task_id).toBe('task-1')
    expect(receipt.task.work_mode).toBe('weclaw_dispatch')
    expect(receipt.run.work_mode).toBe('weclaw_dispatch')
    expect(receipt.run.runtime_profile).toBe('dev_local_acp_bridge')
    expect(receipt.run.runtime_target).toBe('local_runtime')
    expect(receipt.run.interaction_surface).toBe('weclaw')
    expect(receipt.run.model_plane).toBe('cloud_provider')
    expect(receipt.run.execution_plane).toBe('local_executor')
    expect(tasks[0]?.task_id).toBe('task-1')
    expect(tasks[0]?.work_mode).toBe('weclaw_dispatch')
    expect(tasks[0]?.origin_surface).toBe('wechat_thread')
    expect(tasks[0]?.runtime_profile).toBe('dev_local_acp_bridge')
    expect(tasks[0]?.runtime_target).toBe('local_runtime')
    expect(tasks[0]?.interaction_surface).toBe('weclaw')
    expect(overview.adapters[0]?.adapter_id).toBe('weclaw')
    expect(overview.mode_summary.tasks.weclaw_dispatch).toBe(1)
    expect(overview.mode_summary.tasks.local).toBe(0)
    expect(workItems[0]?.run_id).toBe('run-1')
    expect(workItems[0]?.work_mode).toBe('weclaw_dispatch')
    expect(workItems[0]?.runtime_target).toBe('local_runtime')
    expect(workItems[0]?.interaction_surface).toBe('weclaw')
    expect(dashboard.pack_id).toBe('due_diligence')
    expect(requests[0]?.body).toMatchObject({
      work_mode: 'weclaw_dispatch',
      launch_surface: 'wechat_thread',
      interaction_surface: 'weclaw',
      runtime_profile: 'dev_local_acp_bridge',
      runtime_target: 'local_runtime',
      model_plane: 'cloud_provider',
      workspace_target: 'conversation:user-1',
    })
    expect(requests.map(item => `${item.method} ${item.url}`)).toEqual([
      'POST http://hermes.local/agent-os/launches',
      'GET http://hermes.local/agent-os/tasks?limit=5',
      'GET http://hermes.local/agent-os/overview',
      'GET http://hermes.local/agent-os/work-items',
      'GET http://hermes.local/agent-os/packs/due_diligence/dashboard',
    ])
  })

  it('derives sensible mode and execution defaults for provisional tasks and overview summaries', async () => {
    const fetchImpl: typeof fetch = async input => {
      const url = String(input)

      if (url === 'http://due.local/runs') {
        return new Response(
          JSON.stringify([
            {
              run_id: 'run-weclaw',
              task_type: 'company',
              status: 'running',
              query: '微信发起的尽调',
              created_at: '2026-04-19T10:00:00Z',
              launch_source: 'weclaw',
              channel: 'wechat',
            },
            {
              run_id: 'run-cloud',
              task_type: 'company',
              status: 'queued',
              query: '云端尽调',
              created_at: '2026-04-19T10:05:00Z',
            },
          ]),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        )
      }

      throw new Error(`Unexpected request: ${url}`)
    }

    const client = new LongclawControlPlaneClient({
      dueDiligenceBaseUrl: 'http://due.local',
      fetchImpl,
    })

    const runs = await client.listRuns()
    const tasks = await client.listTasks(10)
    const overview = await client.getOverview()

    const weclawRun = runs.find(run => run.run_id === 'run-weclaw')
    const cloudRun = runs.find(run => run.run_id === 'run-cloud')
    const weclawTask = tasks.find(task => task.task_id === 'task:provisional:run-weclaw')
    const cloudTask = tasks.find(task => task.task_id === 'task:provisional:run-cloud')

    expect(weclawRun?.work_mode).toBe('weclaw_dispatch')
    expect(weclawRun?.runtime_profile).toBe('dev_local_acp_bridge')
    expect(weclawRun?.runtime_target).toBe('local_runtime')
    expect(weclawRun?.interaction_surface).toBe('weclaw')
    expect(weclawRun?.execution_plane).toBe('local_executor')
    expect(weclawTask?.work_mode).toBe('weclaw_dispatch')
    expect(weclawTask?.origin_surface).toBe('weclaw')
    expect(weclawTask?.runtime_target).toBe('local_runtime')
    expect(weclawTask?.interaction_surface).toBe('weclaw')
    expect(cloudRun?.work_mode).toBe('cloud_sandbox')
    expect(cloudRun?.runtime_target).toBe('cloud_runtime')
    expect(cloudRun?.interaction_surface).toBe('electron_home')
    expect(cloudRun?.execution_plane).toBe('cloud_executor')
    expect(cloudTask?.work_mode).toBe('cloud_sandbox')
    expect(cloudTask?.runtime_target).toBe('cloud_runtime')
    expect(cloudTask?.interaction_surface).toBe('electron_home')
    expect(cloudTask?.execution_plane).toBe('cloud_executor')
    expect(overview.mode_summary.tasks.weclaw_dispatch).toBe(1)
    expect(overview.mode_summary.tasks.cloud_sandbox).toBe(1)
    expect(overview.mode_summary.runs.weclaw_dispatch).toBe(1)
    expect(overview.mode_summary.runs.cloud_sandbox).toBe(1)
  })

  it('returns degraded dashboards for known packs instead of throwing when runtimes are unavailable', async () => {
    const client = new LongclawControlPlaneClient({
      fetchImpl: async input => {
        throw new Error(`offline:${String(input)}`)
      },
    })

    const dueDashboard = await client.getPackDashboard('due_diligence')
    const signalsDashboard = await client.getPackDashboard('signals')

    expect(dueDashboard.pack_id).toBe('due_diligence')
    expect(dueDashboard.status).toBe('not_connected')
    expect(dueDashboard.notice).toContain('not configured')
    expect(signalsDashboard.pack_id).toBe('signals')
    expect(signalsDashboard.status).toBe('not_connected')
    expect(signalsDashboard.notice).toContain('not configured')
  })

  it('falls back to degraded due diligence dashboard when the runtime is configured but unavailable', async () => {
    const client = new LongclawControlPlaneClient({
      dueDiligenceBaseUrl: 'http://due.local',
      fetchImpl: async input => {
        throw new Error(`unreachable:${String(input)}`)
      },
    })

    const dashboard = await client.getPackDashboard('due_diligence')

    expect(dashboard.pack_id).toBe('due_diligence')
    expect(dashboard.status).toBe('degraded')
    expect(dashboard.notice).toContain('unreachable:http://due.local')
  })
})
