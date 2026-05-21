import { useEffect, useMemo, useState } from 'react'
import './App.css'

type RelationshipStrength = 0 | 1 | 3 | 9

type CorrelationStrength = -2 | -1 | 0 | 1 | 2

type CustomerNeed = {
  id: string
  name: string
  importance: number
}

type TechnicalRequirement = {
  id: string
  name: string
  difficulty: number
}

type ChatRole = 'user' | 'assistant'

type ChatMessage = {
  id: string
  role: ChatRole
  content: string
}

type AiProvider = 'openai' | 'anthropic' | 'gemini' | 'openrouter' | 'other'

type AiConfig = {
  enabled: boolean
  provider: AiProvider
  endpoint: string
  apiKey: string
  model: string
}

type HouseDraft = {
  title?: string
  problemStatement?: string
  customerNeeds?: Array<{
    name: string
    importance?: number
  }>
  technicalRequirements?: Array<{
    name: string
    difficulty?: number
  }>
  relationships?: Array<{
    customerNeed: string
    technicalRequirement: string
    value: RelationshipStrength
  }>
  correlations?: Array<{
    left: string
    right: string
    value: CorrelationStrength
  }>
  summary?: string
}

type MatrixState = Record<string, RelationshipStrength>
type RoofState = Record<string, CorrelationStrength>

type SavedState = {
  projectTitle: string
  problemStatement: string
  customerNeeds: CustomerNeed[]
  technicalRequirements: TechnicalRequirement[]
  matrix: MatrixState
  roofMatrix: RoofState
  aiConfig: AiConfig
  chatMessages: ChatMessage[]
}

const STORAGE_KEY = 'open-quality-house-state'
const relationshipCycle: RelationshipStrength[] = [0, 1, 3, 9]
const roofCycle: CorrelationStrength[] = [0, 1, 2, -1, -2]
let fallbackIdCounter = 0

const providerOptions: Array<{ value: AiProvider; label: string; description: string }> = [
  {
    value: 'openai',
    label: 'OpenAI',
    description: 'Fast structured ideation with GPT models.',
  },
  {
    value: 'anthropic',
    label: 'Anthropic',
    description: 'Helpful for long, requirements-heavy reasoning.',
  },
  {
    value: 'gemini',
    label: 'Google Gemini',
    description: 'Great if you already manage Google AI keys.',
  },
  {
    value: 'openrouter',
    label: 'OpenRouter',
    description: 'Single API surface for multiple LLMs.',
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Use any OpenAI-compatible endpoint and API key.',
  },
]

const providerDefaults: Record<AiProvider, Pick<AiConfig, 'endpoint' | 'model'>> = {
  openai: {
    endpoint: 'https://api.openai.com/v1/chat/completions',
    model: 'gpt-4.1-mini',
  },
  anthropic: {
    endpoint: 'https://api.anthropic.com/v1/messages',
    model: 'claude-3-5-sonnet-latest',
  },
  gemini: {
    endpoint: 'https://generativelanguage.googleapis.com/v1beta/models',
    model: 'gemini-2.5-flash',
  },
  openrouter: {
    endpoint: 'https://openrouter.ai/api/v1/chat/completions',
    model: 'openai/gpt-4.1-mini',
  },
  other: {
    endpoint: 'https://your-endpoint.example.com/v1/chat/completions',
    model: 'your-model',
  },
}

const starterNeeds: CustomerNeed[] = [
  { id: createId(), name: 'Reduce rework across teams', importance: 5 },
  { id: createId(), name: 'Improve customer satisfaction', importance: 4 },
  { id: createId(), name: 'Shorten time-to-resolution', importance: 4 },
]

const starterTechnicalRequirements: TechnicalRequirement[] = [
  { id: createId(), name: 'Shared issue taxonomy', difficulty: 3 },
  { id: createId(), name: 'Automated alerts and dashboards', difficulty: 4 },
  { id: createId(), name: 'Cross-functional review ritual', difficulty: 2 },
]

const starterMessages: ChatMessage[] = [
  {
    id: createId(),
    role: 'assistant',
    content:
      'Describe the problem space, users, and constraints. I can propose customer needs, technical responses, and a first House of Quality draft.',
  },
]

const emptyAiConfig: AiConfig = {
  enabled: false,
  provider: 'openai',
  endpoint: providerDefaults.openai.endpoint,
  apiKey: '',
  model: providerDefaults.openai.model,
}

function loadSavedState(): SavedState {
  if (typeof window === 'undefined') {
    return {
      projectTitle: 'Complex Problem House of Quality',
      problemStatement:
        'Map what matters to customers against the technical actions most likely to reduce cross-functional pain.',
      customerNeeds: starterNeeds,
      technicalRequirements: starterTechnicalRequirements,
      matrix: {},
      roofMatrix: {},
      aiConfig: emptyAiConfig,
      chatMessages: starterMessages,
    }
  }

  const savedState = window.localStorage.getItem(STORAGE_KEY)

  if (!savedState) {
    return {
      projectTitle: 'Complex Problem House of Quality',
      problemStatement:
        'Map what matters to customers against the technical actions most likely to reduce cross-functional pain.',
      customerNeeds: starterNeeds,
      technicalRequirements: starterTechnicalRequirements,
      matrix: {},
      roofMatrix: {},
      aiConfig: emptyAiConfig,
      chatMessages: starterMessages,
    }
  }

  try {
    const parsed = JSON.parse(savedState) as Partial<SavedState>
    return {
      projectTitle: parsed.projectTitle ?? 'Complex Problem House of Quality',
      problemStatement:
        parsed.problemStatement ??
        'Map what matters to customers against the technical actions most likely to reduce cross-functional pain.',
      customerNeeds: parsed.customerNeeds?.length ? parsed.customerNeeds : starterNeeds,
      technicalRequirements: parsed.technicalRequirements?.length
        ? parsed.technicalRequirements
        : starterTechnicalRequirements,
      matrix: parsed.matrix ?? {},
      roofMatrix: parsed.roofMatrix ?? {},
      aiConfig: { ...emptyAiConfig, ...parsed.aiConfig },
      chatMessages: parsed.chatMessages?.length ? parsed.chatMessages : starterMessages,
    }
  } catch {
    window.localStorage.removeItem(STORAGE_KEY)
    return {
      projectTitle: 'Complex Problem House of Quality',
      problemStatement:
        'Map what matters to customers against the technical actions most likely to reduce cross-functional pain.',
      customerNeeds: starterNeeds,
      technicalRequirements: starterTechnicalRequirements,
      matrix: {},
      roofMatrix: {},
      aiConfig: emptyAiConfig,
      chatMessages: starterMessages,
    }
  }
}

function createId() {
  const webCrypto = globalThis.crypto

  if (webCrypto) {
    if (typeof webCrypto.randomUUID === 'function') {
      return webCrypto.randomUUID()
    }

    const bytes = new Uint8Array(16)
    webCrypto.getRandomValues(bytes)
    return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('')
  }

  fallbackIdCounter += 1
  return `id-${Date.now()}-${fallbackIdCounter}`
}

function relationshipKey(customerNeedId: string, technicalRequirementId: string) {
  return `${customerNeedId}:${technicalRequirementId}`
}

function roofKey(leftId: string, rightId: string) {
  return [leftId, rightId].sort().join(':')
}

function getNextValue<T>(cycle: readonly T[], current: T) {
  const index = cycle.indexOf(current)
  return cycle[(index + 1) % cycle.length]
}

function coerceRelationship(value: number): RelationshipStrength {
  return relationshipCycle.includes(value as RelationshipStrength) ? (value as RelationshipStrength) : 0
}

function coerceCorrelation(value: number): CorrelationStrength {
  return roofCycle.includes(value as CorrelationStrength) ? (value as CorrelationStrength) : 0
}

function getProviderRequest(
  config: AiConfig,
  prompt: string,
  history: ChatMessage[],
): {
  url: string
  options: RequestInit
  extractText: (response: Response) => Promise<string>
} {
  const systemPrompt = `You are helping create a House of Quality. Return concise advice plus a JSON object in a fenced code block using this schema:\n\n${JSON.stringify(
    {
      title: 'string',
      problemStatement: 'string',
      customerNeeds: [{ name: 'string', importance: 1 }],
      technicalRequirements: [{ name: 'string', difficulty: 1 }],
      relationships: [
        {
          customerNeed: 'string',
          technicalRequirement: 'string',
          value: 0,
        },
      ],
      correlations: [
        {
          left: 'string',
          right: 'string',
          value: 0,
        },
      ],
      summary: 'string',
    },
    null,
    2,
  )}\n\nUse relationship values 0, 1, 3, or 9. Use correlation values -2, -1, 0, 1, or 2.`

  const messages = [
    ...history.slice(-6).map((message) => ({
      role: message.role,
      content: message.content,
    })),
    { role: 'user' as const, content: prompt },
  ]

  switch (config.provider) {
    case 'anthropic':
      {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01',
        }

      return {
        url: config.endpoint,
        options: {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: config.model,
            max_tokens: 1800,
            system: systemPrompt,
            messages,
          }),
        },
        extractText: async (response: Response) => {
          const data = (await response.json()) as {
            content?: Array<{ type: string; text?: string }>
            error?: { message?: string }
          }

          if (!response.ok) {
            throw new Error(data.error?.message ?? 'Anthropic request failed.')
          }

          return data.content?.map((item) => item.text ?? '').join('\n').trim() ?? ''
        },
      }
      }
    case 'gemini': {
      const baseEndpoint = config.endpoint.replace(/\/+$/, '')
      const url = `${baseEndpoint}/${config.model}:generateContent?key=${encodeURIComponent(config.apiKey)}`

      return {
        url,
        options: {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            systemInstruction: {
              parts: [{ text: systemPrompt }],
            },
            contents: [
              {
                role: 'user',
                parts: [{ text: messages.map((message) => `${message.role}: ${message.content}`).join('\n\n') }],
              },
            ],
          }),
        },
        extractText: async (response: Response) => {
          const data = (await response.json()) as {
            candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
            error?: { message?: string }
          }

          if (!response.ok) {
            throw new Error(data.error?.message ?? 'Gemini request failed.')
          }

          return (
            data.candidates?.[0]?.content?.parts
              ?.map((part) => part.text ?? '')
              .join('\n')
              .trim() ?? ''
          )
        },
      }
    }
    case 'openai':
    case 'openrouter':
    case 'other':
    default:
      {
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${config.apiKey}`,
        }

      return {
        url: config.endpoint,
        options: {
          method: 'POST',
          headers,
          body: JSON.stringify({
            model: config.model,
            temperature: 0.4,
            messages: [
              { role: 'system', content: systemPrompt },
              ...messages,
            ],
          }),
        },
        extractText: async (response: Response) => {
          const data = (await response.json()) as {
            choices?: Array<{ message?: { content?: string } }>
            error?: { message?: string }
          }

          if (!response.ok) {
            throw new Error(data.error?.message ?? 'Chat completion request failed.')
          }

          return data.choices?.[0]?.message?.content?.trim() ?? ''
        },
      }
      }
  }
}

function extractDraft(text: string) {
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const jsonSource = fencedMatch?.[1] ?? text.match(/\{[\s\S]*\}/)?.[0]

  if (!jsonSource) {
    return null
  }

  try {
    return JSON.parse(jsonSource) as HouseDraft
  } catch {
    return null
  }
}

function App() {
  const [initialState] = useState(loadSavedState)
  const [projectTitle, setProjectTitle] = useState(initialState.projectTitle)
  const [problemStatement, setProblemStatement] = useState(initialState.problemStatement)
  const [customerNeeds, setCustomerNeeds] = useState<CustomerNeed[]>(initialState.customerNeeds)
  const [technicalRequirements, setTechnicalRequirements] = useState<TechnicalRequirement[]>(
    initialState.technicalRequirements,
  )
  const [matrix, setMatrix] = useState<MatrixState>(initialState.matrix)
  const [roofMatrix, setRoofMatrix] = useState<RoofState>(initialState.roofMatrix)
  const [aiConfig, setAiConfig] = useState<AiConfig>(initialState.aiConfig)
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(initialState.chatMessages)
  const [chatInput, setChatInput] = useState('')
  const [assistantStatus, setAssistantStatus] = useState('')
  const [assistantError, setAssistantError] = useState('')
  const [assistantOpen, setAssistantOpen] = useState(true)

  useEffect(() => {
    const state: SavedState = {
      projectTitle,
      problemStatement,
      customerNeeds,
      technicalRequirements,
      matrix,
      roofMatrix,
      aiConfig,
      chatMessages,
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [
    aiConfig,
    chatMessages,
    customerNeeds,
    matrix,
    problemStatement,
    projectTitle,
    roofMatrix,
    technicalRequirements,
  ])

  const weightedScores = useMemo(() => {
    return technicalRequirements.reduce<Record<string, number>>((scores, requirement) => {
      scores[requirement.id] = customerNeeds.reduce((sum, need) => {
        const weight = matrix[relationshipKey(need.id, requirement.id)] ?? 0
        return sum + need.importance * weight
      }, 0)
      return scores
    }, {})
  }, [customerNeeds, matrix, technicalRequirements])

  const totalOpportunity = useMemo(
    () => Object.values(weightedScores).reduce((sum, value) => sum + value, 0),
    [weightedScores],
  )

  function updateNeed(id: string, field: 'name' | 'importance', value: string | number) {
    setCustomerNeeds((current) =>
      current.map((need) =>
        need.id === id
          ? {
              ...need,
              [field]: field === 'importance' ? Number(value) || 1 : value,
            }
          : need,
      ),
    )
  }

  function updateTechnicalRequirement(
    id: string,
    field: 'name' | 'difficulty',
    value: string | number,
  ) {
    setTechnicalRequirements((current) =>
      current.map((requirement) =>
        requirement.id === id
          ? {
              ...requirement,
              [field]: field === 'difficulty' ? Number(value) || 1 : value,
            }
          : requirement,
      ),
    )
  }

  function addCustomerNeed() {
    setCustomerNeeds((current) => [
      ...current,
      { id: createId(), name: `Customer need ${current.length + 1}`, importance: 3 },
    ])
  }

  function addTechnicalRequirement() {
    setTechnicalRequirements((current) => [
      ...current,
      { id: createId(), name: `Technical response ${current.length + 1}`, difficulty: 3 },
    ])
  }

  function removeCustomerNeed(id: string) {
    if (customerNeeds.length === 1) {
      return
    }

    setCustomerNeeds((current) => current.filter((need) => need.id !== id))
    setMatrix((current) =>
      Object.fromEntries(Object.entries(current).filter(([key]) => !key.startsWith(`${id}:`))),
    )
  }

  function removeTechnicalRequirement(id: string) {
    if (technicalRequirements.length === 1) {
      return
    }

    setTechnicalRequirements((current) => current.filter((requirement) => requirement.id !== id))
    setMatrix((current) =>
      Object.fromEntries(Object.entries(current).filter(([key]) => !key.endsWith(`:${id}`))),
    )
    setRoofMatrix((current) =>
      Object.fromEntries(Object.entries(current).filter(([key]) => !key.includes(id))),
    )
  }

  function cycleRelationship(customerNeedId: string, technicalRequirementId: string) {
    const key = relationshipKey(customerNeedId, technicalRequirementId)
    setMatrix((current) => ({
      ...current,
      [key]: getNextValue(relationshipCycle, current[key] ?? 0),
    }))
  }

  function cycleRoof(leftId: string, rightId: string) {
    const key = roofKey(leftId, rightId)
    setRoofMatrix((current) => ({
      ...current,
      [key]: getNextValue(roofCycle, current[key] ?? 0),
    }))
  }

  function resetBoard() {
    setProjectTitle('Complex Problem House of Quality')
    setProblemStatement(
      'Map what matters to customers against the technical actions most likely to reduce cross-functional pain.',
    )
    setCustomerNeeds(starterNeeds)
    setTechnicalRequirements(starterTechnicalRequirements)
    setMatrix({})
    setRoofMatrix({})
    setChatMessages(starterMessages)
    setAssistantError('')
    setAssistantStatus('Reset to the starter template.')
  }

  function applyDraft(draft: HouseDraft) {
    const nextNeeds =
      draft.customerNeeds?.length
        ? draft.customerNeeds.map((need) => ({
            id: createId(),
            name: need.name,
            importance: Math.min(5, Math.max(1, Number(need.importance) || 3)),
          }))
        : customerNeeds

    const nextRequirements =
      draft.technicalRequirements?.length
        ? draft.technicalRequirements.map((requirement) => ({
            id: createId(),
            name: requirement.name,
            difficulty: Math.min(5, Math.max(1, Number(requirement.difficulty) || 3)),
          }))
        : technicalRequirements

    const needIdByName = new Map(nextNeeds.map((need) => [need.name.toLowerCase(), need.id]))
    const requirementIdByName = new Map(
      nextRequirements.map((requirement) => [requirement.name.toLowerCase(), requirement.id]),
    )

    const nextMatrix: MatrixState = {}
    draft.relationships?.forEach((relationship) => {
      const needId = needIdByName.get(relationship.customerNeed.toLowerCase())
      const requirementId = requirementIdByName.get(
        relationship.technicalRequirement.toLowerCase(),
      )

      if (needId && requirementId) {
        nextMatrix[relationshipKey(needId, requirementId)] = coerceRelationship(relationship.value)
      }
    })

    const nextRoof: RoofState = {}
    draft.correlations?.forEach((correlation) => {
      const leftId = requirementIdByName.get(correlation.left.toLowerCase())
      const rightId = requirementIdByName.get(correlation.right.toLowerCase())

      if (leftId && rightId && leftId !== rightId) {
        nextRoof[roofKey(leftId, rightId)] = coerceCorrelation(correlation.value)
      }
    })

    setProjectTitle(draft.title?.trim() || projectTitle)
    setProblemStatement(draft.problemStatement?.trim() || problemStatement)
    setCustomerNeeds(nextNeeds)
    setTechnicalRequirements(nextRequirements)
    setMatrix(nextMatrix)
    setRoofMatrix(nextRoof)
    setAssistantStatus(draft.summary?.trim() || 'Applied AI draft to the board.')
  }

  async function generateDraft() {
    if (!aiConfig.enabled) {
      setAssistantError('Enable the assistant before requesting a draft.')
      return
    }

    if (!chatInput.trim()) {
      setAssistantError('Add a short brief so the assistant knows what problem to solve.')
      return
    }

    if (!aiConfig.apiKey.trim()) {
      setAssistantError('Add an API key for the selected provider.')
      return
    }

    setAssistantError('')
    setAssistantStatus('Generating a draft House of Quality...')

    const userMessage: ChatMessage = {
      id: createId(),
      role: 'user',
      content: chatInput.trim(),
    }

    setChatMessages((current) => [...current, userMessage])

    try {
      const request = getProviderRequest(aiConfig, chatInput.trim(), chatMessages)
      const response = await fetch(request.url, request.options)
      const responseText = await request.extractText(response)
      const assistantMessage: ChatMessage = {
        id: createId(),
        role: 'assistant',
        content: responseText,
      }

      setChatMessages((current) => [...current, assistantMessage])

      const draft = extractDraft(responseText)
      if (draft) {
        applyDraft(draft)
      } else {
        setAssistantStatus('Received a response. No structured draft was detected, so the board was left unchanged.')
      }

      setChatInput('')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to reach the AI provider.'
      setAssistantError(message)
      setAssistantStatus('')
    }
  }

  function updateProvider(provider: AiProvider) {
    setAiConfig((current) => ({
      ...current,
      provider,
      endpoint: providerDefaults[provider].endpoint,
      model: providerDefaults[provider].model,
    }))
  }

  return (
    <main className="app-shell">
      <section className="hero-panel card">
        <div>
          <p className="eyebrow">Frontend-only quality planning</p>
          <h1>Open Quality House</h1>
          <p className="hero-copy">
            Build a modern House of Quality in the browser, score what matters most, and optionally
            use an AI assistant to bootstrap the matrix.
          </p>
          <div className="hero-tags">
            <span>React + Vite</span>
            <span>Smooth transitions</span>
            <span>No backend required</span>
          </div>
        </div>
        <div className="analysis-card">
          <h2>Why React?</h2>
          <p>
            React is the best fit here because the app is a highly interactive single-page matrix with
            optional AI integrations, and React + Vite keeps the bundle lean while making dynamic
            state updates straightforward.
          </p>
        </div>
      </section>

      <section className="overview-grid">
        <article className="card summary-card">
          <span className="summary-label">Customer needs</span>
          <strong>{customerNeeds.length}</strong>
          <p>Rank and edit the problems your users care about most.</p>
        </article>
        <article className="card summary-card">
          <span className="summary-label">Technical responses</span>
          <strong>{technicalRequirements.length}</strong>
          <p>Track the delivery levers that can address each need.</p>
        </article>
        <article className="card summary-card accent">
          <span className="summary-label">Weighted opportunity</span>
          <strong>{totalOpportunity}</strong>
          <p>Scores update instantly as you refine relationships.</p>
        </article>
      </section>

      <section className="workspace-grid">
        <div className="workspace-main">
          <article className="card section-card">
            <div className="section-header">
              <div>
                <p className="eyebrow">Project brief</p>
                <h2>Define the challenge</h2>
              </div>
              <button type="button" className="ghost-button" onClick={resetBoard}>
                Reset board
              </button>
            </div>
            <div className="form-grid">
              <label>
                House of Quality title
                <input
                  value={projectTitle}
                  onChange={(event) => setProjectTitle(event.target.value)}
                  placeholder="Problem or initiative name"
                />
              </label>
              <label className="full-width">
                Problem statement
                <textarea
                  rows={3}
                  value={problemStatement}
                  onChange={(event) => setProblemStatement(event.target.value)}
                  placeholder="Summarize the multifactorial problem this matrix should solve"
                />
              </label>
            </div>
          </article>

          <div className="editor-grid">
            <article className="card section-card">
              <div className="section-header">
                <div>
                  <p className="eyebrow">Voice of the customer</p>
                  <h2>Customer needs</h2>
                </div>
                <button type="button" className="primary-button" onClick={addCustomerNeed}>
                  Add need
                </button>
              </div>
              <div className="stack-list">
                {customerNeeds.map((need) => (
                  <div key={need.id} className="item-row">
                    <input
                      aria-label="Customer need"
                      value={need.name}
                      onChange={(event) => updateNeed(need.id, 'name', event.target.value)}
                    />
                    <label className="compact-field">
                      Importance
                      <input
                        type="number"
                        min="1"
                        max="5"
                        value={need.importance}
                        onChange={(event) => updateNeed(need.id, 'importance', event.target.value)}
                      />
                    </label>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => removeCustomerNeed(need.id)}
                      disabled={customerNeeds.length === 1}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </article>

            <article className="card section-card">
              <div className="section-header">
                <div>
                  <p className="eyebrow">How to respond</p>
                  <h2>Technical requirements</h2>
                </div>
                <button type="button" className="primary-button" onClick={addTechnicalRequirement}>
                  Add response
                </button>
              </div>
              <div className="stack-list">
                {technicalRequirements.map((requirement) => (
                  <div key={requirement.id} className="item-row">
                    <input
                      aria-label="Technical requirement"
                      value={requirement.name}
                      onChange={(event) =>
                        updateTechnicalRequirement(requirement.id, 'name', event.target.value)
                      }
                    />
                    <label className="compact-field">
                      Difficulty
                      <input
                        type="number"
                        min="1"
                        max="5"
                        value={requirement.difficulty}
                        onChange={(event) =>
                          updateTechnicalRequirement(
                            requirement.id,
                            'difficulty',
                            event.target.value,
                          )
                        }
                      />
                    </label>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => removeTechnicalRequirement(requirement.id)}
                      disabled={technicalRequirements.length === 1}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </article>
          </div>

          <article className="card section-card">
            <div className="section-header">
              <div>
                <p className="eyebrow">House matrix</p>
                <h2>{projectTitle}</h2>
              </div>
              <p className="helper-copy">Click cells to cycle 0 → 1 → 3 → 9.</p>
            </div>
            <p className="problem-copy">{problemStatement}</p>
            <div className="table-scroll">
              <table className="matrix-table">
                <thead>
                  <tr>
                    <th>Customer needs</th>
                    {technicalRequirements.map((requirement) => (
                      <th key={requirement.id}>{requirement.name}</th>
                    ))}
                    <th>Importance</th>
                  </tr>
                </thead>
                <tbody>
                  {customerNeeds.map((need) => (
                    <tr key={need.id}>
                      <th>{need.name}</th>
                      {technicalRequirements.map((requirement) => {
                        const key = relationshipKey(need.id, requirement.id)
                        const value = matrix[key] ?? 0

                        return (
                          <td key={key}>
                            <button
                              type="button"
                              className={`matrix-cell strength-${value}`}
                              onClick={() => cycleRelationship(need.id, requirement.id)}
                              aria-label={`Relationship between ${need.name} and ${requirement.name}: ${value}`}
                            >
                              {value}
                            </button>
                          </td>
                        )
                      })}
                      <td>{need.importance}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th>Weighted score</th>
                    {technicalRequirements.map((requirement) => (
                      <td key={requirement.id}>{weightedScores[requirement.id] ?? 0}</td>
                    ))}
                    <td>{totalOpportunity}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </article>

          <article className="card section-card">
            <div className="section-header">
              <div>
                <p className="eyebrow">Roof</p>
                <h2>Technical correlations</h2>
              </div>
              <p className="helper-copy">Click cells to cycle 0 → + → ++ → − → −−.</p>
            </div>
            <div className="table-scroll">
              <table className="roof-table">
                <thead>
                  <tr>
                    <th></th>
                    {technicalRequirements.map((requirement) => (
                      <th key={`roof-head-${requirement.id}`}>{requirement.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {technicalRequirements.map((leftRequirement, rowIndex) => (
                    <tr key={`roof-row-${leftRequirement.id}`}>
                      <th>{leftRequirement.name}</th>
                      {technicalRequirements.map((rightRequirement, columnIndex) => {
                        if (columnIndex <= rowIndex) {
                          return <td key={rightRequirement.id} className="roof-empty" />
                        }

                        const key = roofKey(leftRequirement.id, rightRequirement.id)
                        const value = roofMatrix[key] ?? 0
                        const label = value === 2 ? '++' : value === 1 ? '+' : value === -1 ? '−' : value === -2 ? '−−' : '0'

                        return (
                          <td key={key}>
                            <button
                              type="button"
                              className={`matrix-cell roof strength-${value}`}
                              onClick={() => cycleRoof(leftRequirement.id, rightRequirement.id)}
                              aria-label={`Correlation between ${leftRequirement.name} and ${rightRequirement.name}: ${label}`}
                            >
                              {label}
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </article>
        </div>

        <aside className={`assistant-panel card ${assistantOpen ? 'open' : 'collapsed'}`}>
          <div className="section-header">
            <div>
              <p className="eyebrow">Optional assistant</p>
              <h2>AI chatbot</h2>
            </div>
            <button
              type="button"
              className="ghost-button"
              onClick={() => setAssistantOpen((current) => !current)}
            >
              {assistantOpen ? 'Collapse' : 'Expand'}
            </button>
          </div>

          {assistantOpen ? (
            <>
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={aiConfig.enabled}
                  onChange={(event) =>
                    setAiConfig((current) => ({ ...current, enabled: event.target.checked }))
                  }
                />
                Enable browser-side AI generation
              </label>

              <form
                className="stack-list assistant-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  void generateDraft()
                }}
              >
                <div className="provider-grid">
                  {providerOptions.map((provider) => (
                    <button
                      key={provider.value}
                      type="button"
                      className={`provider-pill ${aiConfig.provider === provider.value ? 'active' : ''}`}
                      onClick={() => updateProvider(provider.value)}
                    >
                      <strong>{provider.label}</strong>
                      <span>{provider.description}</span>
                    </button>
                  ))}
                </div>

                <div className="stack-list config-list">
                  <label>
                    Model
                    <input
                      value={aiConfig.model}
                      onChange={(event) =>
                        setAiConfig((current) => ({ ...current, model: event.target.value }))
                      }
                      placeholder="Model name"
                    />
                  </label>
                  <label>
                    API key
                    <input
                      type="password"
                      autoComplete="current-password"
                      value={aiConfig.apiKey}
                      onChange={(event) =>
                        setAiConfig((current) => ({ ...current, apiKey: event.target.value }))
                      }
                      placeholder="Stored only in this browser"
                    />
                  </label>
                  <label>
                    Endpoint
                    <input
                      value={aiConfig.endpoint}
                      onChange={(event) =>
                        setAiConfig((current) => ({ ...current, endpoint: event.target.value }))
                      }
                      placeholder="Provider endpoint"
                    />
                  </label>
                </div>

                <p className="helper-copy">
                  API keys stay in localStorage on this device. If you do not want AI help, leave
                  the assistant disabled and build the matrix manually.
                </p>

                <div className="chat-log" aria-live="polite">
                  {chatMessages.map((message) => (
                    <article key={message.id} className={`chat-bubble ${message.role}`}>
                      <span>{message.role === 'assistant' ? 'Assistant' : 'You'}</span>
                      <p>{message.content}</p>
                    </article>
                  ))}
                </div>

                <label>
                  Describe the problem, users, constraints, and desired outcomes
                  <textarea
                    rows={5}
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value)}
                    placeholder="Example: We need to reduce onboarding friction for enterprise customers while lowering support load."
                  />
                </label>

                {assistantStatus ? <p className="status-message success">{assistantStatus}</p> : null}
                {assistantError ? <p className="status-message error">{assistantError}</p> : null}

                <button type="submit" className="primary-button full-width">
                  Generate House of Quality draft
                </button>
              </form>
            </>
          ) : null}
        </aside>
      </section>
    </main>
  )
}

export default App
