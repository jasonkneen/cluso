const z = require('zod');

// ----------------------------------------------------------------------------
// 1. Logic from hooks/useAIChatV2.ts (Simulated)
// ----------------------------------------------------------------------------

function convertZodToJsonSchema(zodSchema) {
  try {
    if ('shape' in zodSchema) {
      // ZodObject - extract shape and convert
      const shape = zodSchema.shape;
      const properties = {};
      const required = [];

      for (const [propName, propSchema] of Object.entries(shape)) {
        const originalDef = propSchema;
        let propDef = originalDef;

        // Unwrap wrappers to get inner type (handle Optional, Nullable, Default, Effects)
        while (propDef._def && (
          propDef._def.typeName === 'ZodOptional' || 
          propDef._def.typeName === 'ZodNullable' || 
          propDef._def.typeName === 'ZodDefault' ||
          propDef._def.typeName === 'ZodEffects'
        )) {
          propDef = propDef._def.innerType || propDef._def.schema;
        }

        const typeName = propDef._def?.typeName || 'ZodString';
        const typeMap = {
          ZodString: 'string',
          ZodNumber: 'number',
          ZodBoolean: 'boolean',
          ZodArray: 'array',
          ZodObject: 'object',
          ZodEnum: 'string',
          ZodNativeEnum: 'string',
        };
        
        properties[propName] = {
          type: typeMap[typeName] || 'string',
          description: propDef._def?.description || propDef.description || originalDef.description || '',
        };
        
        // Check if required (use original definition)
        if (!originalDef.isOptional?.()) {
          required.push(propName);
        }
      }

      return {
        type: 'object',
        properties,
        required: required.length > 0 ? required : undefined,
      };
    } else {
      // Fallback for non-object Zod schemas
      return { type: 'object', properties: {} };
    }
  } catch (e) {
    console.error('Conversion error:', e);
    return { type: 'object', properties: {} };
  }
}

// ----------------------------------------------------------------------------
// 2. Logic from electron/ai-sdk-wrapper.cjs (Updated)
// ----------------------------------------------------------------------------

function jsonSchemaToZod(schema) {
  function convertType(prop) {
    let zodType;

    switch (prop.type) {
      case 'string':
        zodType = z.string();
        break;
      case 'number':
      case 'integer':
        zodType = z.number();
        break;
      case 'boolean':
        zodType = z.boolean();
        break;
      case 'array':
        if (prop.items) {
          zodType = z.array(convertType(prop.items));
        } else {
          zodType = z.array(z.any());
        }
        break;
      case 'object':
        if (prop.properties) {
          const shape = {};
          const required = prop.required || [];
          for (const [key, subProp] of Object.entries(prop.properties)) {
            let subZodType = convertType(subProp);
            if (!required.includes(key)) {
              subZodType = subZodType.optional();
            }
            shape[key] = subZodType;
          }
          zodType = z.object(shape).passthrough();
        } else {
          zodType = z.object({}).passthrough();
        }
        break;
      default:
        zodType = z.any();
    }

    if (prop.description) {
      zodType = zodType.describe(prop.description);
    }

    return zodType;
  }

  if (!schema || schema.type !== 'object') {
    return z.object({});
  }

  const shape = {};
  const properties = schema.properties || {};
  const required = schema.required || [];

  for (const [key, prop] of Object.entries(properties)) {
    let zodType = convertType(prop);

    if (!required.includes(key)) {
      zodType = zodType.optional();
    }

    shape[key] = zodType;
  }

  return z.object(shape);
}

// ----------------------------------------------------------------------------
// 3. Test Case
// ----------------------------------------------------------------------------

// Define a tool like in useCodingAgent.ts
const originalToolSchema = z.object({
  path: z.string().describe('Absolute path to the file'),
  content: z.string().optional().describe('Content to write'),
  recursive: z.boolean().default(false).describe('Recursive operation'),
});

console.log('Original Zod Schema Shape Keys:', Object.keys(originalToolSchema.shape));

// Step 1: Convert to JSON Schema (Frontend -> IPC)
const jsonSchema = convertZodToJsonSchema(originalToolSchema);
console.log('\nConverted JSON Schema:', JSON.stringify(jsonSchema, null, 2));

// Step 2: Convert back to Zod (IPC -> Backend)
const restoredZodSchema = jsonSchemaToZod(jsonSchema);
console.log('\nRestored Zod Schema Shape Keys:', Object.keys(restoredZodSchema.shape));

// Step 3: Validate data against restored schema
const validData = {
  path: '/tmp/test.txt',
  content: 'hello',
  recursive: true
};

const validDataMissingOptional = {
  path: '/tmp/test.txt',
  // content missing (optional)
  // recursive missing (optional in JSON schema because we didn't preserve default value logic fully, but it should be optional)
};

try {
  const parsed1 = restoredZodSchema.parse(validData);
  console.log('\nValidation 1 (Full data): Success', parsed1);
} catch (e) {
  console.error('\nValidation 1 Failed:', e.errors);
}

try {
  const parsed2 = restoredZodSchema.parse(validDataMissingOptional);
  console.log('\nValidation 2 (Missing optional): Success', parsed2);
} catch (e) {
  console.error('\nValidation 2 Failed:', e.errors);
}

// Check if descriptions are preserved
const pathDesc = restoredZodSchema.shape.path.description;
console.log('\nPath Description Preserved:', pathDesc === 'Absolute path to the file' ? 'YES' : `NO (${pathDesc})`);
