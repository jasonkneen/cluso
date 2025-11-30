/**
 * Provider Factory - Creates configured language models for different providers
 * Handles API key management, custom endpoints, and provider-specific features
 */

import { LanguageModel } from 'ai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import type { ModelConfig, ModelProvider, ProviderFeatures } from './types'

/**
 * Get feature capabilities for each provider
 */
export const getProviderFeatures = (provider: ModelProvider): ProviderFeatures => {
  const features: Record<ModelProvider, ProviderFeatures> = {
    anthropic: {
      supportsStreaming: true,
      supportsToolCalling: true,
      supportsReasoning: true,
      supportsVision: true,
      supportsFunctionCalling: false,
      maxTokens: 200000,
      maxToolsPerRequest: 1000,
    },
    openai: {
      supportsStreaming: true,
      supportsToolCalling: true,
      supportsReasoning: false,
      supportsVision: true,
      supportsFunctionCalling: true,
      maxTokens: 128000,
      maxToolsPerRequest: 128,
    },
    google: {
      supportsStreaming: true,
      supportsToolCalling: true,
      supportsReasoning: false,
      supportsVision: true,
      supportsFunctionCalling: true,
      maxTokens: 1000000,
      maxToolsPerRequest: 128,
    },
    custom: {
      supportsStreaming: true,
      supportsToolCalling: true,
      supportsReasoning: false,
      supportsVision: false,
      supportsFunctionCalling: true,
      maxTokens: 100000,
      maxToolsPerRequest: 50,
    },
  }
  return features[provider]
}

/**
 * Create an Anthropic model instance
 */
const createAnthropicModel = (config: ModelConfig): LanguageModel => {
  const client = createAnthropic({
    apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY,
    baseURL: config.baseURL,
    fetch: config.customFetch,
  })

  return client(config.modelId)
}

/**
 * Create an OpenAI model instance
 */
const createOpenAIModel = (config: ModelConfig): LanguageModel => {
  const client = createOpenAI({
    apiKey: config.apiKey || process.env.OPENAI_API_KEY,
    baseURL: config.baseURL,
    fetch: config.customFetch,
  })

  return client(config.modelId)
}

/**
 * Create a Google Generative AI model instance
 */
const createGoogleModel = (config: ModelConfig): LanguageModel => {
  const client = createGoogleGenerativeAI({
    apiKey: config.apiKey || process.env.GOOGLE_API_KEY,
    baseURL: config.baseURL,
    fetch: config.customFetch,
  })

  return client(config.modelId)
}

/**
 * Factory function to create a language model from config
 * Validates required configuration before creation
 */
export const createLanguageModel = (config: ModelConfig): LanguageModel => {
  const { provider, modelId, apiKey } = config

  // Validate API key is available
  let effectiveApiKey = apiKey
  if (!effectiveApiKey) {
    const envKeyMap: Record<ModelProvider, string> = {
      anthropic: 'ANTHROPIC_API_KEY',
      openai: 'OPENAI_API_KEY',
      google: 'GOOGLE_API_KEY',
      custom: 'CUSTOM_API_KEY',
    }
    effectiveApiKey = process.env[envKeyMap[provider]]
  }

  if (!effectiveApiKey) {
    throw new Error(
      `No API key provided for ${provider}. ` +
      `Set the API key in config or ${provider === 'custom' ? 'CUSTOM_API_KEY' : 'ANTHROPIC_API_KEY' + ' environment variable'}`
    )
  }

  // Create model based on provider
  switch (provider) {
    case 'anthropic':
      return createAnthropicModel(config)
    case 'openai':
      return createOpenAIModel(config)
    case 'google':
      return createGoogleModel(config)
    case 'custom':
      // Custom provider must have baseURL configured
      if (!config.baseURL) {
        throw new Error('Custom provider requires baseURL configuration')
      }
      return createOpenAIModel({
        ...config,
        apiKey: effectiveApiKey,
      })
    default:
      throw new Error(`Unsupported provider: ${provider}`)
  }
}

/**
 * Create multiple models and return as a map
 */
export const createModelMap = (
  configs: ModelConfig[]
): Record<string, LanguageModel> => {
  const models: Record<string, LanguageModel> = {}

  for (const config of configs) {
    const key = config.modelId || config.provider
    models[key] = createLanguageModel(config)
  }

  return models
}

/**
 * Get the appropriate model from a map by preference
 */
export const getModel = (
  models: Record<string, LanguageModel>,
  preference?: string
): LanguageModel => {
  if (preference && models[preference]) {
    return models[preference]
  }

  const keys = Object.keys(models)
  if (keys.length === 0) {
    throw new Error('No models available')
  }

  // Return first model as default
  return models[keys[0]]
}

/**
 * Validate model configuration
 */
export const validateModelConfig = (config: ModelConfig): boolean => {
  if (!config.provider || !config.modelId) {
    return false
  }

  // Check if API key is available (either in config or env)
  const envKeyMap: Record<ModelProvider, string> = {
    anthropic: 'ANTHROPIC_API_KEY',
    openai: 'OPENAI_API_KEY',
    google: 'GOOGLE_API_KEY',
    custom: 'CUSTOM_API_KEY',
  }

  const hasApiKey =
    config.apiKey || process.env[envKeyMap[config.provider]]

  return hasApiKey !== undefined && hasApiKey !== null
}
