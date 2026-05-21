import { useEffect, useMemo, useRef, useState } from 'react'
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
type Language = 'en' | 'es'

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

type BoardState = {
  projectTitle: string
  problemStatement: string
  customerNeeds: CustomerNeed[]
  technicalRequirements: TechnicalRequirement[]
  matrix: Record<string, RelationshipStrength>
  roofMatrix: Record<string, CorrelationStrength>
}

type SavedState = BoardState & {
  aiConfig: AiConfig
  chatMessages: ChatMessage[]
  language: Language
}

type EditorStep = 'brief' | 'needs' | 'requirements' | 'matrix'

type ExportedHouseFile = HouseDraft & {
  format: 'open-quality-house'
  version: 1
}

const STORAGE_KEY = 'open-quality-house-state'
const relationshipCycle: RelationshipStrength[] = [0, 1, 3, 9]
const roofCycle: CorrelationStrength[] = [0, 1, 2, -1, -2]
const HISTORY_LIMIT = 20
let fallbackIdCounter = 0

const translations = {
  en: {
    appTitle: 'Open Quality House',
    appSubtitle: 'Build, save, and refine a House of Quality from a compact responsive workspace.',
    file: 'File',
    export: 'Export',
    import: 'Import',
    reset: 'Reset',
    undo: 'Undo',
    redo: 'Redo',
    ai: 'AI',
    menu: 'Menu',
    language: 'Language',
    english: 'English',
    spanish: 'Spanish',
    mainEyebrow: 'House of Quality',
    editHouse: 'Edit House Of Quality',
    editDescription:
      'Update the brief, customer needs, technical requirements, and matrix values in a guided modal.',
    customerNeeds: 'Customer needs',
    technicalResponses: 'Technical responses',
    weightedOpportunity: 'Weighted opportunity',
    matrixTitle: 'Relationship matrix',
    matrixHelper: 'Click cells to cycle 0 → 1 → 3 → 9.',
    roofTitle: 'Technical correlations',
    roofHelper: 'Click cells to cycle 0 → + → ++ → − → −−.',
    importance: 'Importance',
    difficulty: 'Difficulty',
    projectBrief: 'Project brief',
    titleLabel: 'House of Quality title',
    titlePlaceholder: 'Problem or initiative name',
    problemLabel: 'Problem statement',
    problemPlaceholder: 'Summarize the multifactorial problem this matrix should solve',
    stepBrief: 'Brief',
    stepNeeds: 'Customer needs',
    stepRequirements: 'Technical requirements',
    stepMatrix: 'Relationships',
    previous: 'Previous',
    next: 'Next',
    close: 'Close',
    done: 'Done',
    addNeed: 'Add need',
    addResponse: 'Add response',
    remove: 'Remove',
    needName: 'Customer need',
    responseName: 'Technical response',
    relationshipGuide: 'Score how strongly each response supports a need.',
    roofGuide: 'Capture positive and negative interactions between responses.',
    aiTitle: 'AI chatbot',
    aiDescription: 'Configure the assistant and optionally generate a first draft of the matrix.',
    enableAssistant: 'Enable browser-side AI generation',
    model: 'Model',
    apiKey: 'API key',
    endpoint: 'Endpoint',
    localOnly: 'API keys stay in localStorage on this device.',
    promptLabel: 'Describe the problem, users, constraints, and desired outcomes',
    promptPlaceholder:
      'Example: We need to reduce onboarding friction for enterprise customers while lowering support load.',
    generateDraft: 'Generate House of Quality draft',
    assistant: 'Assistant',
    you: 'You',
    importSuccess: 'House of Quality imported successfully.',
    exportSuccess: 'House of Quality exported successfully.',
    resetSuccess: 'House of Quality reset to the starter template.',
    resetConfirm: 'Do you want to clear the current House of Quality and restore the starter template?',
    invalidImport: 'Select a valid exported House of Quality JSON file.',
    importReadError: 'The selected file could not be read.',
    assistantDisabledError: 'Enable the assistant before requesting a draft.',
    briefRequiredError: 'Add a short brief so the assistant knows what problem to solve.',
    apiKeyRequiredError: 'Add an API key for the selected provider.',
    generatingDraft: 'Generating a draft House of Quality...',
    draftApplied: 'Applied AI draft to the board.',
    noDraftDetected: 'Received a response, but no structured draft was detected.',
    importHint: 'Imported files must match the exported House of Quality JSON structure.',
  },
  es: {
    appTitle: 'Open Quality House',
    appSubtitle: 'Crea, guarda y ajusta una Casa de la Calidad desde un espacio de trabajo adaptable.',
    file: 'Archivo',
    export: 'Exportar',
    import: 'Importar',
    reset: 'Reiniciar',
    undo: 'Deshacer',
    redo: 'Rehacer',
    ai: 'IA',
    menu: 'Menú',
    language: 'Idioma',
    english: 'Inglés',
    spanish: 'Español',
    mainEyebrow: 'Casa de la Calidad',
    editHouse: 'Editar Casa de la Calidad',
    editDescription:
      'Actualiza el resumen, las necesidades del cliente, los requisitos técnicos y la matriz en un modal guiado.',
    customerNeeds: 'Necesidades del cliente',
    technicalResponses: 'Respuestas técnicas',
    weightedOpportunity: 'Oportunidad ponderada',
    matrixTitle: 'Matriz de relaciones',
    matrixHelper: 'Haz clic en las celdas para alternar 0 → 1 → 3 → 9.',
    roofTitle: 'Correlaciones técnicas',
    roofHelper: 'Haz clic en las celdas para alternar 0 → + → ++ → − → −−.',
    importance: 'Importancia',
    difficulty: 'Dificultad',
    projectBrief: 'Resumen del proyecto',
    titleLabel: 'Título de la Casa de la Calidad',
    titlePlaceholder: 'Nombre del problema o iniciativa',
    problemLabel: 'Descripción del problema',
    problemPlaceholder: 'Resume el problema multifactorial que debe resolver esta matriz',
    stepBrief: 'Resumen',
    stepNeeds: 'Necesidades del cliente',
    stepRequirements: 'Requisitos técnicos',
    stepMatrix: 'Relaciones',
    previous: 'Anterior',
    next: 'Siguiente',
    close: 'Cerrar',
    done: 'Listo',
    addNeed: 'Agregar necesidad',
    addResponse: 'Agregar respuesta',
    remove: 'Eliminar',
    needName: 'Necesidad del cliente',
    responseName: 'Respuesta técnica',
    relationshipGuide: 'Puntúa cuánto ayuda cada respuesta a una necesidad.',
    roofGuide: 'Registra interacciones positivas y negativas entre respuestas.',
    aiTitle: 'Chatbot de IA',
    aiDescription: 'Configura el asistente y genera opcionalmente un primer borrador de la matriz.',
    enableAssistant: 'Habilitar generación con IA en el navegador',
    model: 'Modelo',
    apiKey: 'Clave API',
    endpoint: 'Endpoint',
    localOnly: 'Las claves API se guardan solo en el localStorage de este dispositivo.',
    promptLabel: 'Describe el problema, los usuarios, las restricciones y los resultados deseados',
    promptPlaceholder:
      'Ejemplo: Necesitamos reducir la fricción del onboarding para clientes empresariales y bajar la carga de soporte.',
    generateDraft: 'Generar borrador de la Casa de la Calidad',
    assistant: 'Asistente',
    you: 'Tú',
    importSuccess: 'La Casa de la Calidad se importó correctamente.',
    exportSuccess: 'La Casa de la Calidad se exportó correctamente.',
    resetSuccess: 'La Casa de la Calidad volvió a la plantilla inicial.',
    resetConfirm: '¿Quieres limpiar la Casa de la Calidad actual y restaurar la plantilla inicial?',
    invalidImport: 'Selecciona un archivo JSON exportado de Casa de la Calidad válido.',
    importReadError: 'No se pudo leer el archivo seleccionado.',
    assistantDisabledError: 'Habilita el asistente antes de solicitar un borrador.',
    briefRequiredError: 'Añade una breve descripción para que el asistente sepa qué problema resolver.',
    apiKeyRequiredError: 'Añade una clave API para el proveedor seleccionado.',
    generatingDraft: 'Generando un borrador de la Casa de la Calidad...',
    draftApplied: 'Se aplicó el borrador de IA al tablero.',
    noDraftDetected: 'Se recibió una respuesta, pero no se detectó un borrador estructurado.',
    importHint:
      'Los archivos importados deben respetar la estructura JSON exportada de la Casa de la Calidad.',
  },
} as const

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

function createStarterBoard(): BoardState {
  return {
    projectTitle: 'Complex Problem House of Quality',
    problemStatement:
      'Map what matters to customers against the technical actions most likely to reduce cross-functional pain.',
    customerNeeds: cloneCustomerNeeds(starterNeeds),
    technicalRequirements: cloneTechnicalRequirements(starterTechnicalRequirements),
    matrix: {},
    roofMatrix: {},
  }
}

function loadSavedState(): SavedState {
  const fallbackState: SavedState = {
    ...createStarterBoard(),
    aiConfig: emptyAiConfig,
    chatMessages: cloneChatMessages(starterMessages),
    language: 'en',
  }

  if (typeof window === 'undefined') {
    return fallbackState
  }

  const savedState = window.localStorage.getItem(STORAGE_KEY)

  if (!savedState) {
    return fallbackState
  }

  try {
    const parsed = JSON.parse(savedState) as Partial<SavedState>
    return {
      projectTitle: parsed.projectTitle ?? fallbackState.projectTitle,
      problemStatement: parsed.problemStatement ?? fallbackState.problemStatement,
      customerNeeds: parsed.customerNeeds?.length ? parsed.customerNeeds : fallbackState.customerNeeds,
      technicalRequirements: parsed.technicalRequirements?.length
        ? parsed.technicalRequirements
        : fallbackState.technicalRequirements,
      matrix: parsed.matrix ?? {},
      roofMatrix: parsed.roofMatrix ?? {},
      aiConfig: { ...emptyAiConfig, ...parsed.aiConfig },
      chatMessages: parsed.chatMessages?.length ? parsed.chatMessages : fallbackState.chatMessages,
      language: parsed.language === 'es' ? 'es' : 'en',
    }
  } catch {
    window.localStorage.removeItem(STORAGE_KEY)
    return fallbackState
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

function normalizeRating(value: number | undefined) {
  return Math.min(5, Math.max(1, Number(value) || 1))
}

function cloneCustomerNeeds(customerNeeds: CustomerNeed[]) {
  return customerNeeds.map((need) => ({ ...need }))
}

function cloneTechnicalRequirements(technicalRequirements: TechnicalRequirement[]) {
  return technicalRequirements.map((requirement) => ({ ...requirement }))
}

function cloneBoardState(state: BoardState): BoardState {
  return {
    projectTitle: state.projectTitle,
    problemStatement: state.problemStatement,
    customerNeeds: cloneCustomerNeeds(state.customerNeeds),
    technicalRequirements: cloneTechnicalRequirements(state.technicalRequirements),
    matrix: { ...state.matrix },
    roofMatrix: { ...state.roofMatrix },
  }
}

function cloneChatMessages(messages: ChatMessage[]) {
  return messages.map((message) => ({ ...message }))
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
    case 'anthropic': {
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
    case 'other': {
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
            messages: [{ role: 'system', content: systemPrompt }, ...messages],
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

function buildBoardFromDraft(draft: HouseDraft, current: BoardState): BoardState {
  const nextNeeds =
    draft.customerNeeds?.length
      ? draft.customerNeeds
          .filter((need) => need.name?.trim())
          .map((need) => ({
            id: createId(),
            name: need.name.trim(),
            importance: normalizeRating(need.importance),
          }))
      : current.customerNeeds

  const nextRequirements =
    draft.technicalRequirements?.length
      ? draft.technicalRequirements
          .filter((requirement) => requirement.name?.trim())
          .map((requirement) => ({
            id: createId(),
            name: requirement.name.trim(),
            difficulty: normalizeRating(requirement.difficulty),
          }))
      : current.technicalRequirements

  const needIdByName = new Map(nextNeeds.map((need) => [need.name.toLowerCase(), need.id]))
  const requirementIdByName = new Map(
    nextRequirements.map((requirement) => [requirement.name.toLowerCase(), requirement.id]),
  )

  const nextMatrix: Record<string, RelationshipStrength> = {}
  draft.relationships?.forEach((relationship) => {
    const needId = needIdByName.get(relationship.customerNeed.toLowerCase())
    const requirementId = requirementIdByName.get(relationship.technicalRequirement.toLowerCase())

    if (needId && requirementId) {
      nextMatrix[relationshipKey(needId, requirementId)] = coerceRelationship(relationship.value)
    }
  })

  const nextRoof: Record<string, CorrelationStrength> = {}
  draft.correlations?.forEach((correlation) => {
    const leftId = requirementIdByName.get(correlation.left.toLowerCase())
    const rightId = requirementIdByName.get(correlation.right.toLowerCase())

    if (leftId && rightId && leftId !== rightId) {
      nextRoof[roofKey(leftId, rightId)] = coerceCorrelation(correlation.value)
    }
  })

  return {
    projectTitle: draft.title?.trim() || current.projectTitle,
    problemStatement: draft.problemStatement?.trim() || current.problemStatement,
    customerNeeds: nextNeeds,
    technicalRequirements: nextRequirements,
    matrix: nextMatrix,
    roofMatrix: nextRoof,
  }
}

function getRelationshipRecords(state: BoardState) {
  return state.customerNeeds.flatMap((need) =>
    state.technicalRequirements.flatMap((requirement) => {
      const value = state.matrix[relationshipKey(need.id, requirement.id)] ?? 0

      return value
        ? [
            {
              customerNeed: need.name,
              technicalRequirement: requirement.name,
              value,
            },
          ]
        : []
    }),
  )
}

function getCorrelationRecords(state: BoardState) {
  return state.technicalRequirements.flatMap((leftRequirement, rowIndex) =>
    state.technicalRequirements.flatMap((rightRequirement, columnIndex) => {
      if (columnIndex <= rowIndex) {
        return []
      }

      const value = state.roofMatrix[roofKey(leftRequirement.id, rightRequirement.id)] ?? 0

      return value
        ? [
            {
              left: leftRequirement.name,
              right: rightRequirement.name,
              value,
            },
          ]
        : []
    }),
  )
}

function createExportPayload(state: BoardState): ExportedHouseFile {
  return {
    format: 'open-quality-house',
    version: 1,
    title: state.projectTitle,
    problemStatement: state.problemStatement,
    customerNeeds: state.customerNeeds.map((need) => ({
      name: need.name,
      importance: need.importance,
    })),
    technicalRequirements: state.technicalRequirements.map((requirement) => ({
      name: requirement.name,
      difficulty: requirement.difficulty,
    })),
    relationships: getRelationshipRecords(state),
    correlations: getCorrelationRecords(state),
  }
}

function parseImportedFile(data: unknown): HouseDraft | null {
  if (!data || typeof data !== 'object') {
    return null
  }

  const candidate = data as Partial<ExportedHouseFile>
  const customerNeeds = Array.isArray(candidate.customerNeeds) ? candidate.customerNeeds : null
  const technicalRequirements = Array.isArray(candidate.technicalRequirements)
    ? candidate.technicalRequirements
    : null

  if (!customerNeeds?.length || !technicalRequirements?.length) {
    return null
  }

  const validNeeds = customerNeeds.every(
    (need) => need && typeof need === 'object' && typeof need.name === 'string' && need.name.trim(),
  )
  const validRequirements = technicalRequirements.every(
    (requirement) =>
      requirement &&
      typeof requirement === 'object' &&
      typeof requirement.name === 'string' &&
      requirement.name.trim(),
  )

  if (!validNeeds || !validRequirements) {
    return null
  }

  return {
    title: typeof candidate.title === 'string' ? candidate.title : undefined,
    problemStatement:
      typeof candidate.problemStatement === 'string' ? candidate.problemStatement : undefined,
    customerNeeds: customerNeeds.map((need) => ({
      name: need.name,
      importance: normalizeRating(need.importance),
    })),
    technicalRequirements: technicalRequirements.map((requirement) => ({
      name: requirement.name,
      difficulty: normalizeRating(requirement.difficulty),
    })),
    relationships: Array.isArray(candidate.relationships)
      ? candidate.relationships
          .filter(
            (relationship) =>
              relationship &&
              typeof relationship === 'object' &&
              typeof relationship.customerNeed === 'string' &&
              typeof relationship.technicalRequirement === 'string',
          )
          .map((relationship) => ({
            customerNeed: relationship.customerNeed,
            technicalRequirement: relationship.technicalRequirement,
            value: coerceRelationship(Number(relationship.value)),
          }))
      : [],
    correlations: Array.isArray(candidate.correlations)
      ? candidate.correlations
          .filter(
            (correlation) =>
              correlation &&
              typeof correlation === 'object' &&
              typeof correlation.left === 'string' &&
              typeof correlation.right === 'string',
          )
          .map((correlation) => ({
            left: correlation.left,
            right: correlation.right,
            value: coerceCorrelation(Number(correlation.value)),
          }))
      : [],
    summary: typeof candidate.summary === 'string' ? candidate.summary : undefined,
  }
}

function slugifyFileName(value: string) {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug || 'house-of-quality'
}

function App() {
  const [initialState] = useState(loadSavedState)
  const [board, setBoard] = useState<BoardState>({
    projectTitle: initialState.projectTitle,
    problemStatement: initialState.problemStatement,
    customerNeeds: initialState.customerNeeds,
    technicalRequirements: initialState.technicalRequirements,
    matrix: initialState.matrix,
    roofMatrix: initialState.roofMatrix,
  })
  const [aiConfig, setAiConfig] = useState(initialState.aiConfig)
  const [chatMessages, setChatMessages] = useState(initialState.chatMessages)
  const [chatInput, setChatInput] = useState('')
  const [assistantStatus, setAssistantStatus] = useState('')
  const [assistantError, setAssistantError] = useState('')
  const [language, setLanguage] = useState<Language>(initialState.language)
  const [undoStack, setUndoStack] = useState<BoardState[]>([])
  const [redoStack, setRedoStack] = useState<BoardState[]>([])
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [isAiModalOpen, setIsAiModalOpen] = useState(false)
  const [fileMenuOpen, setFileMenuOpen] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [editorStep, setEditorStep] = useState<EditorStep>('brief')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const boardRef = useRef(board)
  const copy = translations[language]

  const { customerNeeds, matrix, problemStatement, projectTitle, roofMatrix, technicalRequirements } =
    board

  useEffect(() => {
    boardRef.current = board
  }, [board])

  useEffect(() => {
    const state: SavedState = {
      ...board,
      aiConfig,
      chatMessages,
      language,
    }

    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [aiConfig, board, chatMessages, language])

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

  const editorSteps: EditorStep[] = ['brief', 'needs', 'requirements', 'matrix']
  const editorStepLabels: Record<EditorStep, string> = {
    brief: copy.stepBrief,
    needs: copy.stepNeeds,
    requirements: copy.stepRequirements,
    matrix: copy.stepMatrix,
  }

  function commitBoard(update: BoardState | ((current: BoardState) => BoardState), skipHistory = false) {
    const current = boardRef.current
    const next = typeof update === 'function' ? update(current) : update

    if (next === current) {
      return
    }

    if (!skipHistory) {
      setUndoStack((previous) => [...previous.slice(-(HISTORY_LIMIT - 1)), cloneBoardState(current)])
      setRedoStack([])
    }

    setBoard(cloneBoardState(next))
  }

  function updateNeed(id: string, field: 'name' | 'importance', value: string | number) {
    commitBoard((current) => ({
      ...current,
      customerNeeds: current.customerNeeds.map((need) =>
        need.id === id
          ? {
              ...need,
              [field]: field === 'importance' ? normalizeRating(Number(value)) : String(value),
            }
          : need,
      ),
    }))
  }

  function updateTechnicalRequirement(
    id: string,
    field: 'name' | 'difficulty',
    value: string | number,
  ) {
    commitBoard((current) => ({
      ...current,
      technicalRequirements: current.technicalRequirements.map((requirement) =>
        requirement.id === id
          ? {
              ...requirement,
              [field]: field === 'difficulty' ? normalizeRating(Number(value)) : String(value),
            }
          : requirement,
      ),
    }))
  }

  function addCustomerNeed() {
    commitBoard((current) => ({
      ...current,
      customerNeeds: [
        ...current.customerNeeds,
        { id: createId(), name: `Customer need ${current.customerNeeds.length + 1}`, importance: 3 },
      ],
    }))
  }

  function addTechnicalRequirement() {
    commitBoard((current) => ({
      ...current,
      technicalRequirements: [
        ...current.technicalRequirements,
        {
          id: createId(),
          name: `Technical response ${current.technicalRequirements.length + 1}`,
          difficulty: 3,
        },
      ],
    }))
  }

  function removeCustomerNeed(id: string) {
    if (customerNeeds.length === 1) {
      return
    }

    commitBoard((current) => ({
      ...current,
      customerNeeds: current.customerNeeds.filter((need) => need.id !== id),
      matrix: Object.fromEntries(
        Object.entries(current.matrix).filter(([key]) => !key.startsWith(`${id}:`)),
      ),
    }))
  }

  function removeTechnicalRequirement(id: string) {
    if (technicalRequirements.length === 1) {
      return
    }

    commitBoard((current) => ({
      ...current,
      technicalRequirements: current.technicalRequirements.filter(
        (requirement) => requirement.id !== id,
      ),
      matrix: Object.fromEntries(
        Object.entries(current.matrix).filter(([key]) => !key.endsWith(`:${id}`)),
      ),
      roofMatrix: Object.fromEntries(
        Object.entries(current.roofMatrix).filter(([key]) => !key.includes(id)),
      ),
    }))
  }

  function cycleRelationship(customerNeedId: string, technicalRequirementId: string) {
    const key = relationshipKey(customerNeedId, technicalRequirementId)
    commitBoard((current) => ({
      ...current,
      matrix: {
        ...current.matrix,
        [key]: getNextValue(relationshipCycle, current.matrix[key] ?? 0),
      },
    }))
  }

  function cycleRoof(leftId: string, rightId: string) {
    const key = roofKey(leftId, rightId)
    commitBoard((current) => ({
      ...current,
      roofMatrix: {
        ...current.roofMatrix,
        [key]: getNextValue(roofCycle, current.roofMatrix[key] ?? 0),
      },
    }))
  }

  function undoBoard() {
    setUndoStack((previous) => {
      const priorState = previous.at(-1)

      if (!priorState) {
        return previous
      }

      setRedoStack((redoHistory) => [
        ...redoHistory.slice(-(HISTORY_LIMIT - 1)),
        cloneBoardState(boardRef.current),
      ])
      setBoard(cloneBoardState(priorState))
      return previous.slice(0, -1)
    })
  }

  function redoBoard() {
    setRedoStack((previous) => {
      const nextState = previous.at(-1)

      if (!nextState) {
        return previous
      }

      setUndoStack((undoHistory) => [
        ...undoHistory.slice(-(HISTORY_LIMIT - 1)),
        cloneBoardState(boardRef.current),
      ])
      setBoard(cloneBoardState(nextState))
      return previous.slice(0, -1)
    })
  }

  function resetBoard() {
    setFileMenuOpen(false)
    setMobileMenuOpen(false)

    if (!window.confirm(copy.resetConfirm)) {
      return
    }

    commitBoard(createStarterBoard())
    setChatMessages(cloneChatMessages(starterMessages))
    setAssistantError('')
    setAssistantStatus(copy.resetSuccess)
  }

  function applyDraft(draft: HouseDraft) {
    const nextBoard = buildBoardFromDraft(draft, boardRef.current)
    commitBoard(nextBoard)
    setAssistantStatus(draft.summary?.trim() || copy.draftApplied)
  }

  async function generateDraft() {
    if (!aiConfig.enabled) {
      setAssistantError(copy.assistantDisabledError)
      return
    }

    if (!chatInput.trim()) {
      setAssistantError(copy.briefRequiredError)
      return
    }

    if (!aiConfig.apiKey.trim()) {
      setAssistantError(copy.apiKeyRequiredError)
      return
    }

    setAssistantError('')
    setAssistantStatus(copy.generatingDraft)

    const userMessage: ChatMessage = {
      id: createId(),
      role: 'user',
      content: chatInput.trim(),
    }

    setChatMessages([...chatMessages, userMessage])

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
        setAssistantStatus(copy.noDraftDetected)
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

  function exportBoard() {
    const payload = createExportPayload(boardRef.current)
    const fileName = `${slugifyFileName(boardRef.current.projectTitle)}.houseofquality.json`
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = fileName
    link.click()
    URL.revokeObjectURL(url)

    setFileMenuOpen(false)
    setMobileMenuOpen(false)
    setAssistantError('')
    setAssistantStatus(copy.exportSuccess)
  }

  function openImportDialog() {
    setFileMenuOpen(false)
    setMobileMenuOpen(false)
    fileInputRef.current?.click()
  }

  async function importBoard(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    try {
      const raw = await file.text()
      const parsed = parseImportedFile(JSON.parse(raw))

      if (!parsed) {
        setAssistantError(copy.invalidImport)
        setAssistantStatus('')
      } else {
        commitBoard(buildBoardFromDraft(parsed, boardRef.current))
        setAssistantError('')
        setAssistantStatus(copy.importSuccess)
      }
    } catch {
      setAssistantError(copy.importReadError)
      setAssistantStatus('')
    } finally {
      event.target.value = ''
    }
  }

  function renderToolbarActions(compact = false) {
    return (
      <>
        {!compact ? (
          <div className="menu-wrapper">
            <button
              type="button"
              className="toolbar-button"
              onClick={() => setFileMenuOpen((current) => !current)}
              aria-expanded={fileMenuOpen}
            >
              <span aria-hidden="true">📁</span>
              <span className="button-label">{copy.file}</span>
            </button>
            {fileMenuOpen ? (
              <div className="toolbar-menu">
                <button type="button" className="menu-item" onClick={exportBoard}>
                  <span aria-hidden="true">⬇️</span>
                  {copy.export}
                </button>
                <button type="button" className="menu-item" onClick={openImportDialog}>
                  <span aria-hidden="true">⬆️</span>
                  {copy.import}
                </button>
                <button type="button" className="menu-item" onClick={resetBoard}>
                  <span aria-hidden="true">🗑️</span>
                  {copy.reset}
                </button>
                <p className="menu-hint">{copy.importHint}</p>
              </div>
            ) : null}
          </div>
        ) : (
          <div className="compact-section">
            <span className="compact-heading">{copy.file}</span>
            <button type="button" className="menu-item compact-item" onClick={exportBoard}>
              <span aria-hidden="true">⬇️</span>
              {copy.export}
            </button>
            <button type="button" className="menu-item compact-item" onClick={openImportDialog}>
              <span aria-hidden="true">⬆️</span>
              {copy.import}
            </button>
            <button type="button" className="menu-item compact-item" onClick={resetBoard}>
              <span aria-hidden="true">🗑️</span>
              {copy.reset}
            </button>
          </div>
        )}

        <button type="button" className="toolbar-button" onClick={undoBoard} disabled={!undoStack.length}>
          <span aria-hidden="true">↶</span>
          <span className="button-label">{copy.undo}</span>
        </button>
        <button type="button" className="toolbar-button" onClick={redoBoard} disabled={!redoStack.length}>
          <span aria-hidden="true">↷</span>
          <span className="button-label">{copy.redo}</span>
        </button>
        <button
          type="button"
          className="toolbar-button"
          onClick={() => {
            setIsAiModalOpen(true)
            setFileMenuOpen(false)
            setMobileMenuOpen(false)
          }}
        >
          <span aria-hidden="true">✨</span>
          <span className="button-label">{copy.ai}</span>
        </button>
      </>
    )
  }

  return (
    <div className="app-shell">
      <header className="app-header card">
        <div>
          <p className="eyebrow">{copy.mainEyebrow}</p>
          <h1>{copy.appTitle}</h1>
          <p className="hero-copy header-copy">{copy.appSubtitle}</p>
        </div>

        <div className="header-toolbar">
          <div className="toolbar desktop-toolbar">{renderToolbarActions()}</div>

          <div className="mobile-toolbar">
            <button
              type="button"
              className="toolbar-button"
              onClick={() => setMobileMenuOpen((current) => !current)}
              aria-expanded={mobileMenuOpen}
            >
              <span aria-hidden="true">☰</span>
              <span className="button-label">{copy.menu}</span>
            </button>
            {mobileMenuOpen ? <div className="toolbar-menu mobile-menu">{renderToolbarActions(true)}</div> : null}
          </div>

          <label className="language-picker">
            <span>{copy.language}</span>
            <select value={language} onChange={(event) => setLanguage(event.target.value as Language)}>
              <option value="en">{copy.english}</option>
              <option value="es">{copy.spanish}</option>
            </select>
          </label>
        </div>
      </header>

      <input
        ref={fileInputRef}
        type="file"
        accept=".json,.houseofquality.json"
        className="hidden-input"
        onChange={importBoard}
      />

      <main className="workspace-main">
        <section className="card board-hero">
          <div>
            <p className="eyebrow">{copy.projectBrief}</p>
            <h2>{projectTitle}</h2>
            <p className="problem-copy">{problemStatement}</p>
          </div>
          <div className="board-hero-actions">
            <button
              type="button"
              className="primary-button"
              onClick={() => {
                setEditorStep('brief')
                setIsEditorOpen(true)
              }}
            >
              {copy.editHouse}
            </button>
            <p className="helper-copy">{copy.editDescription}</p>
          </div>
        </section>

        {(assistantStatus || assistantError) && (
          <section className="status-row">
            {assistantStatus ? <p className="status-message success">{assistantStatus}</p> : null}
            {assistantError ? <p className="status-message error">{assistantError}</p> : null}
          </section>
        )}

        <section className="overview-grid">
          <article className="card summary-card">
            <span className="summary-label">{copy.customerNeeds}</span>
            <strong>{customerNeeds.length}</strong>
          </article>
          <article className="card summary-card">
            <span className="summary-label">{copy.technicalResponses}</span>
            <strong>{technicalRequirements.length}</strong>
          </article>
          <article className="card summary-card accent">
            <span className="summary-label">{copy.weightedOpportunity}</span>
            <strong>{totalOpportunity}</strong>
          </article>
        </section>

        <article className="card section-card">
          <div className="section-header">
            <div>
              <p className="eyebrow">{copy.mainEyebrow}</p>
              <h2>{copy.matrixTitle}</h2>
            </div>
            <p className="helper-copy">{copy.matrixHelper}</p>
          </div>
          <div className="table-scroll">
            <table className="matrix-table">
              <thead>
                <tr>
                  <th>{copy.customerNeeds}</th>
                  {technicalRequirements.map((requirement) => (
                    <th key={requirement.id}>{requirement.name}</th>
                  ))}
                  <th>{copy.importance}</th>
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
                  <th>{copy.weightedOpportunity}</th>
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
              <h2>{copy.roofTitle}</h2>
            </div>
            <p className="helper-copy">{copy.roofHelper}</p>
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
                      const label =
                        value === 2 ? '++' : value === 1 ? '+' : value === -1 ? '−' : value === -2 ? '−−' : '0'

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
      </main>

      {isEditorOpen ? (
        <div className="modal-overlay" role="presentation" onClick={() => setIsEditorOpen(false)}>
          <div
            className="modal card editor-modal"
            role="dialog"
            aria-modal="true"
            aria-label={copy.editHouse}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">{copy.mainEyebrow}</p>
                <h2>{copy.editHouse}</h2>
              </div>
              <button type="button" className="ghost-button" onClick={() => setIsEditorOpen(false)}>
                {copy.close}
              </button>
            </div>

            <div className="editor-layout">
              <nav className="stepper" aria-label={copy.editHouse}>
                {editorSteps.map((step) => (
                  <button
                    key={step}
                    type="button"
                    className={`step-pill ${editorStep === step ? 'active' : ''}`}
                    onClick={() => setEditorStep(step)}
                  >
                    {editorStepLabels[step]}
                  </button>
                ))}
              </nav>

              <div className="editor-content">
                {editorStep === 'brief' ? (
                  <div className="stack-list">
                    <label>
                      {copy.titleLabel}
                      <input
                        value={projectTitle}
                        onChange={(event) =>
                          commitBoard((current) => ({ ...current, projectTitle: event.target.value }))
                        }
                        placeholder={copy.titlePlaceholder}
                      />
                    </label>
                    <label>
                      {copy.problemLabel}
                      <textarea
                        rows={4}
                        value={problemStatement}
                        onChange={(event) =>
                          commitBoard((current) => ({ ...current, problemStatement: event.target.value }))
                        }
                        placeholder={copy.problemPlaceholder}
                      />
                    </label>
                  </div>
                ) : null}

                {editorStep === 'needs' ? (
                  <div className="stack-list">
                    <div className="section-header compact-header">
                      <p className="helper-copy">{copy.customerNeeds}</p>
                      <button type="button" className="primary-button" onClick={addCustomerNeed}>
                        {copy.addNeed}
                      </button>
                    </div>
                    {customerNeeds.map((need) => (
                      <div key={need.id} className="item-row">
                        <label>
                          {copy.needName}
                          <input
                            value={need.name}
                            onChange={(event) => updateNeed(need.id, 'name', event.target.value)}
                          />
                        </label>
                        <label className="compact-field">
                          {copy.importance}
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
                          {copy.remove}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                {editorStep === 'requirements' ? (
                  <div className="stack-list">
                    <div className="section-header compact-header">
                      <p className="helper-copy">{copy.technicalResponses}</p>
                      <button type="button" className="primary-button" onClick={addTechnicalRequirement}>
                        {copy.addResponse}
                      </button>
                    </div>
                    {technicalRequirements.map((requirement) => (
                      <div key={requirement.id} className="item-row">
                        <label>
                          {copy.responseName}
                          <input
                            value={requirement.name}
                            onChange={(event) =>
                              updateTechnicalRequirement(requirement.id, 'name', event.target.value)
                            }
                          />
                        </label>
                        <label className="compact-field">
                          {copy.difficulty}
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
                          {copy.remove}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                {editorStep === 'matrix' ? (
                  <div className="stack-list">
                    <p className="helper-copy">{copy.relationshipGuide}</p>
                    <div className="table-scroll modal-table-scroll">
                      <table className="matrix-table compact-matrix-table">
                        <thead>
                          <tr>
                            <th>{copy.customerNeeds}</th>
                            {technicalRequirements.map((requirement) => (
                              <th key={`editor-${requirement.id}`}>{requirement.name}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {customerNeeds.map((need) => (
                            <tr key={`editor-row-${need.id}`}>
                              <th>{need.name}</th>
                              {technicalRequirements.map((requirement) => {
                                const key = relationshipKey(need.id, requirement.id)
                                const value = matrix[key] ?? 0

                                return (
                                  <td key={`editor-cell-${key}`}>
                                    <button
                                      type="button"
                                      className={`matrix-cell strength-${value}`}
                                      onClick={() => cycleRelationship(need.id, requirement.id)}
                                    >
                                      {value}
                                    </button>
                                  </td>
                                )
                              })}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="helper-copy">{copy.roofGuide}</p>
                    <div className="table-scroll modal-table-scroll">
                      <table className="roof-table compact-matrix-table">
                        <thead>
                          <tr>
                            <th></th>
                            {technicalRequirements.map((requirement) => (
                              <th key={`editor-roof-head-${requirement.id}`}>{requirement.name}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {technicalRequirements.map((leftRequirement, rowIndex) => (
                            <tr key={`editor-roof-row-${leftRequirement.id}`}>
                              <th>{leftRequirement.name}</th>
                              {technicalRequirements.map((rightRequirement, columnIndex) => {
                                if (columnIndex <= rowIndex) {
                                  return <td key={rightRequirement.id} className="roof-empty" />
                                }

                                const key = roofKey(leftRequirement.id, rightRequirement.id)
                                const value = roofMatrix[key] ?? 0
                                const label =
                                  value === 2
                                    ? '++'
                                    : value === 1
                                      ? '+'
                                      : value === -1
                                        ? '−'
                                        : value === -2
                                          ? '−−'
                                          : '0'

                                return (
                                  <td key={`editor-roof-cell-${key}`}>
                                    <button
                                      type="button"
                                      className={`matrix-cell roof strength-${value}`}
                                      onClick={() => cycleRoof(leftRequirement.id, rightRequirement.id)}
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
                  </div>
                ) : null}
              </div>
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  const currentIndex = editorSteps.indexOf(editorStep)
                  setEditorStep(editorSteps[Math.max(0, currentIndex - 1)])
                }}
                disabled={editorStep === editorSteps[0]}
              >
                {copy.previous}
              </button>
              {editorStep === editorSteps[editorSteps.length - 1] ? (
                <button type="button" className="primary-button" onClick={() => setIsEditorOpen(false)}>
                  {copy.done}
                </button>
              ) : (
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => {
                    const currentIndex = editorSteps.indexOf(editorStep)
                    setEditorStep(editorSteps[Math.min(editorSteps.length - 1, currentIndex + 1)])
                  }}
                >
                  {copy.next}
                </button>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {isAiModalOpen ? (
        <div className="modal-overlay" role="presentation" onClick={() => setIsAiModalOpen(false)}>
          <div
            className="modal card ai-modal"
            role="dialog"
            aria-modal="true"
            aria-label={copy.aiTitle}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <p className="eyebrow">{copy.ai}</p>
                <h2>{copy.aiTitle}</h2>
                <p className="helper-copy">{copy.aiDescription}</p>
              </div>
              <button type="button" className="ghost-button" onClick={() => setIsAiModalOpen(false)}>
                {copy.close}
              </button>
            </div>

            <label className="toggle-row">
              <input
                type="checkbox"
                checked={aiConfig.enabled}
                onChange={(event) => setAiConfig((current) => ({ ...current, enabled: event.target.checked }))}
              />
              {copy.enableAssistant}
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
                  {copy.model}
                  <input
                    value={aiConfig.model}
                    onChange={(event) =>
                      setAiConfig((current) => ({ ...current, model: event.target.value }))
                    }
                    placeholder="Model name"
                  />
                </label>
                <label>
                  {copy.apiKey}
                  <input
                    type="password"
                    autoComplete="current-password"
                    value={aiConfig.apiKey}
                    onChange={(event) =>
                      setAiConfig((current) => ({ ...current, apiKey: event.target.value }))
                    }
                    placeholder={copy.localOnly}
                  />
                </label>
                <label>
                  {copy.endpoint}
                  <input
                    value={aiConfig.endpoint}
                    onChange={(event) =>
                      setAiConfig((current) => ({ ...current, endpoint: event.target.value }))
                    }
                    placeholder="Provider endpoint"
                  />
                </label>
              </div>

              <p className="helper-copy">{copy.localOnly}</p>

              <div className="chat-log" aria-live="polite">
                {chatMessages.map((message) => (
                  <article key={message.id} className={`chat-bubble ${message.role}`}>
                    <span>{message.role === 'assistant' ? copy.assistant : copy.you}</span>
                    <p>{message.content}</p>
                  </article>
                ))}
              </div>

              <label>
                {copy.promptLabel}
                <textarea
                  rows={5}
                  value={chatInput}
                  onChange={(event) => setChatInput(event.target.value)}
                  placeholder={copy.promptPlaceholder}
                />
              </label>

              {assistantStatus ? <p className="status-message success">{assistantStatus}</p> : null}
              {assistantError ? <p className="status-message error">{assistantError}</p> : null}

              <button type="submit" className="primary-button full-width">
                {copy.generateDraft}
              </button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default App
