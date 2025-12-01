/**
 * Shared Zod/JSON Schema conversion utilities
 * Provides bidirectional conversion between Zod schemas and JSON Schema
 */

import type { z as zodType } from 'zod'

// JSON Schema types
export interface JsonSchemaProperty {
  type: string
  description?: string
  enum?: string[]
  items?: JsonSchemaProperty
  properties?: Record<string, JsonSchemaProperty>
  required?: string[]
}

export interface JsonSchema {
  type: 'object'
  properties: Record<string, JsonSchemaProperty>
  required?: string[]
}

// Zod schema detection
interface ZodLikeSchema {
  _def?: {
    typeName?: string
    description?: string
    innerType?: ZodLikeSchema
    schema?: ZodLikeSchema
    values?: string[]
  }
  shape?: Record<string, ZodLikeSchema>
  isOptional?: () => boolean
  description?: string
}

/**
 * Check if a value is a Zod schema (has _def property)
 */
export function isZodSchema(value: unknown): value is ZodLikeSchema {
  return (
    typeof value === 'object' &&
    value !== null &&
    '_def' in value
  )
}

/**
 * Convert a Zod schema to JSON Schema format
 * Handles common Zod types: string, number, boolean, array, object, enum, optional
 */
export function zodToJsonSchema(zodSchema: unknown): JsonSchema {
  if (!isZodSchema(zodSchema)) {
    return { type: 'object', properties: {} }
  }

  // Check if it's a ZodObject with shape
  if (!zodSchema.shape) {
    return { type: 'object', properties: {} }
  }

  const properties: Record<string, JsonSchemaProperty> = {}
  const required: string[] = []

  for (const [propName, propSchema] of Object.entries(zodSchema.shape)) {
    if (!isZodSchema(propSchema)) continue

    const originalSchema = propSchema
    let unwrappedSchema = propSchema

    // Unwrap wrappers to get inner type (handle Optional, Nullable, Default, Effects)
    while (
      unwrappedSchema._def &&
      (unwrappedSchema._def.typeName === 'ZodOptional' ||
        unwrappedSchema._def.typeName === 'ZodNullable' ||
        unwrappedSchema._def.typeName === 'ZodDefault' ||
        unwrappedSchema._def.typeName === 'ZodEffects')
    ) {
      const inner = unwrappedSchema._def.innerType || unwrappedSchema._def.schema
      if (!inner) break
      unwrappedSchema = inner
    }

    const typeName = unwrappedSchema._def?.typeName || 'ZodString'
    const typeMap: Record<string, string> = {
      ZodString: 'string',
      ZodNumber: 'number',
      ZodBoolean: 'boolean',
      ZodArray: 'array',
      ZodObject: 'object',
      ZodEnum: 'string',
      ZodNativeEnum: 'string',
    }

    const property: JsonSchemaProperty = {
      type: typeMap[typeName] || 'string',
    }

    // Add description if present
    const description =
      unwrappedSchema._def?.description ||
      unwrappedSchema.description ||
      originalSchema.description
    if (description) {
      property.description = description
    }

    // Handle enums
    if (typeName === 'ZodEnum' && unwrappedSchema._def?.values) {
      property.enum = unwrappedSchema._def.values
    }

    properties[propName] = property

    // Check if required (use original definition)
    if (!originalSchema.isOptional?.()) {
      required.push(propName)
    }
  }

  return {
    type: 'object',
    properties,
    required: required.length > 0 ? required : undefined,
  }
}

/**
 * Convert JSON Schema to Zod schema
 * Requires passing the zod module to avoid import issues
 */
export function jsonSchemaToZod(
  schema: JsonSchema | { type: 'object'; properties?: Record<string, JsonSchemaProperty>; required?: string[] },
  z: typeof zodType
): ReturnType<typeof zodType.object> {
  if (!schema.properties) {
    return z.object({})
  }

  const shape: Record<string, ReturnType<typeof zodType.unknown>> = {}

  for (const [key, prop] of Object.entries(schema.properties)) {
    let zodType: ReturnType<typeof z.unknown>

    switch (prop.type) {
      case 'string':
        if (prop.enum && prop.enum.length > 0) {
          zodType = z.enum(prop.enum as [string, ...string[]])
        } else {
          zodType = z.string()
        }
        break
      case 'number':
      case 'integer':
        zodType = z.number()
        break
      case 'boolean':
        zodType = z.boolean()
        break
      case 'array':
        if (prop.items) {
          const itemSchema = jsonSchemaToZod(
            { type: 'object', properties: { item: prop.items } },
            z
          )
          const itemShape = itemSchema.shape as Record<string, ReturnType<typeof z.unknown>>
          zodType = z.array(itemShape.item || z.unknown())
        } else {
          zodType = z.array(z.unknown())
        }
        break
      case 'object':
        if (prop.properties) {
          zodType = jsonSchemaToZod(prop as JsonSchema, z)
        } else {
          zodType = z.record(z.unknown())
        }
        break
      default:
        zodType = z.unknown()
    }

    // Add description if present
    if (prop.description) {
      zodType = zodType.describe(prop.description)
    }

    // Make optional if not required
    if (!schema.required?.includes(key)) {
      zodType = zodType.optional()
    }

    shape[key] = zodType
  }

  return z.object(shape)
}

/**
 * Normalize parameters to JSON Schema format
 * Handles both Zod schemas and plain objects
 */
export function normalizeToJsonSchema(params: unknown): JsonSchema {
  if (isZodSchema(params)) {
    return zodToJsonSchema(params)
  }

  if (typeof params === 'object' && params !== null) {
    const obj = params as Record<string, unknown>
    if (!obj.type) {
      return { type: 'object', ...obj } as JsonSchema
    }
    if (!obj.properties) {
      return { ...obj, properties: {} } as JsonSchema
    }
    return obj as JsonSchema
  }

  return { type: 'object', properties: {} }
}
