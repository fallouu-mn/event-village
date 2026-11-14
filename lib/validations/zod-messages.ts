/**
 * Lot 9 sexies (zod 4) : messages « valeur absente » et « type inattendu » d'un schéma.
 *
 * Zod 3 acceptait `{ required_error, invalid_type_error }` ; zod 4 ne garde que `error`. Cette aide rend
 * exactement les mêmes messages :
 *  - valeur absente (`undefined`) → `required` ;
 *  - valeur d'un autre type (`null` compris, comme en zod 3) → `invalid` ;
 *  - pour une liste fermée (`z.enum`), zod 4 signale aussi l'absence et le mauvais type par `invalid_value` :
 *    même partage ; une chaîne hors de la liste garde le message par défaut, comme en zod 3.
 * Les messages des contrôles (`.min(…, 'message')`, `.refine`) restent prioritaires, comme avant.
 */
export interface ZodTypeMessages {
    required?: string;
    invalid?: string;
}

interface TypeIssue {
    code: string;
    input?: unknown;
}

export function zodTypeErrors(messages: ZodTypeMessages): { error: (issue: TypeIssue) => string | undefined } {
    return {
        error: (issue) => {
            if (issue.code !== 'invalid_type' && issue.code !== 'invalid_value') return undefined;
            if (issue.input === undefined) return messages.required;
            if (issue.code === 'invalid_type' || typeof issue.input !== 'string') return messages.invalid;
            return undefined;
        },
    };
}
