import type { useAnalysis } from '../../analysis/useAnalysis'
import type { useEditorSession } from '../../editor-session/useEditorSession'
import type { useProjectDocument } from '../../../state/project-store/useProjectDocument'

export type ReturnTypeUseProjectDocument = ReturnType<typeof useProjectDocument>
export type ReturnTypeUseEditorSession = ReturnType<typeof useEditorSession>
export type ReturnTypeUseAnalysis = ReturnType<typeof useAnalysis>
