import OpenAI from 'openai';
import { z } from 'zod';
import { logger } from './security/logger';

// Initialize OpenAI client with environment variables
const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY || '',
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL || 'https://api.openai.com/v1'
});

// Common ICD-10 codes for quick reference (Canadian healthcare)
const COMMON_ICD10_CODES = {
  // Primary care common codes
  'J06.9': 'Acute upper respiratory infection, unspecified',
  'K21.0': 'Gastro-esophageal reflux disease with esophagitis',
  'M25.5': 'Pain in joint',
  'M54.5': 'Low back pain',
  'M79.3': 'Myalgia',
  'R07.9': 'Chest pain, unspecified',
  'R10.4': 'Other and unspecified abdominal pain',
  'R50.9': 'Fever, unspecified',
  'R51': 'Headache',
  'I10': 'Essential (primary) hypertension',
  'E11.9': 'Type 2 diabetes mellitus without complications',
  'E78.5': 'Hyperlipidemia, unspecified',
  'F32.9': 'Major depressive disorder, single episode, unspecified',
  'F41.9': 'Anxiety disorder, unspecified',
  'Z00.0': 'General adult medical examination',
  // Injuries
  'S93.4': 'Sprain of ankle',
  'S52.5': 'Fracture of lower end of radius',
  'S43.0': 'Dislocation of shoulder joint',
  // Common procedures
  'Z01.0': 'Examination of eyes and vision',
  'Z01.1': 'Examination of ears and hearing',
  'Z01.2': 'Dental examination',
};

// Common procedure codes for Canadian healthcare
const COMMON_PROCEDURE_CODES = {
  // Ontario OHIP codes
  'A001': 'Minor assessment',
  'A003': 'General assessment',
  'A007': 'Intermediate assessment',
  'A008': 'Mini assessment',
  'K005': 'Primary care consultation',
  'K013': 'Consultation, primary mental health care',
  'K017': 'Annual health exam',
  // Common procedures
  'G365': 'ECG interpretation',
  'G538': 'Injection, single',
  'Z204': 'Sutures, simple',
  'Z206': 'Sutures, intermediate'
};

// Pre-authorization requirements based on procedure codes
const PREAUTH_REQUIRED = {
  // Imaging
  'X092': { procedure: 'MRI scan', requiresAuth: true, reason: 'High-cost diagnostic imaging' },
  'X093': { procedure: 'CT scan', requiresAuth: true, reason: 'Advanced imaging procedure' },
  // Surgery
  'S065': { procedure: 'Knee arthroscopy', requiresAuth: true, reason: 'Surgical procedure' },
  'S067': { procedure: 'Carpal tunnel release', requiresAuth: true, reason: 'Surgical procedure' },
  // Specialist referrals
  'A665': { procedure: 'Specialist consultation - Orthopedic', requiresAuth: true, reason: 'Specialist referral' },
  'A415': { procedure: 'Specialist consultation - Cardiology', requiresAuth: true, reason: 'Specialist referral' }
};

// Schema for document analysis response
const DocumentAnalysisSchema = z.object({
  patientName: z.string().optional(),
  dateOfService: z.string().optional(),
  diagnosis: z.string().optional(),
  symptoms: z.array(z.string()).optional(),
  treatmentPlan: z.string().optional(),
  medicationsPrescribed: z.array(z.string()).optional(),
  proceduresPerformed: z.array(z.string()).optional(),
  followUpRequired: z.boolean().optional(),
  referralNeeded: z.string().optional()
});

// Schema for ICD-10 code suggestion
const ICD10SuggestionSchema = z.object({
  code: z.string(),
  description: z.string(),
  confidence: z.number(),
  category: z.string().optional()
});

// Schema for validation response
const ValidationResponseSchema = z.object({
  isValid: z.boolean(),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
  suggestions: z.array(z.string()),
  missingFields: z.array(z.string())
});

export class AIClaimsAssistant {
  private isAvailable: boolean = true;
  
  constructor() {
    // Check if OpenAI is configured
    if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
      logger.warn('OpenAI API key not configured - AI assistance will be disabled');
      this.isAvailable = false;
    }
  }

  /**
   * Analyze a medical document and extract key information
   */
  async analyzeDocument(documentText: string): Promise<any> {
    if (!this.isAvailable) {
      return this.getFallbackDocumentAnalysis();
    }

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are a medical claims assistant helping healthcare providers in Canada. 
                     Extract key information from medical documents for insurance claims.
                     Focus on: patient information, diagnosis, procedures, medications, and follow-up requirements.
                     Use Canadian medical terminology and ICD-10-CA codes when applicable.`
          },
          {
            role: 'user',
            content: `Please analyze this medical document and extract key information for a claim:\n\n${documentText}`
          }
        ],
        functions: [{
          name: 'extractDocumentInfo',
          description: 'Extract structured information from medical document',
          parameters: {
            type: 'object',
            properties: DocumentAnalysisSchema.shape,
            required: []
          }
        }],
        function_call: { name: 'extractDocumentInfo' },
        temperature: 0.3,
        max_tokens: 500
      });

      const functionCall = completion.choices[0]?.message?.function_call;
      if (functionCall?.arguments) {
        const analysis = JSON.parse(functionCall.arguments);
        return {
          ...analysis,
          tokensUsed: completion.usage?.total_tokens || 0
        };
      }

      return this.getFallbackDocumentAnalysis();
    } catch (error) {
      logger.error('Document analysis failed', { error });
      return this.getFallbackDocumentAnalysis();
    }
  }

  /**
   * Suggest ICD-10 codes based on diagnosis description
   */
  async suggestICD10Codes(diagnosis: string, symptoms?: string[]): Promise<any> {
    if (!this.isAvailable) {
      return this.getFallbackICD10Suggestions(diagnosis);
    }

    try {
      // First check common codes for exact matches
      const quickSuggestions = this.getQuickICD10Suggestions(diagnosis);
      if (quickSuggestions.length > 0) {
        return {
          suggestions: quickSuggestions,
          tokensUsed: 0
        };
      }

      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are a medical coding expert familiar with ICD-10-CA codes used in Canadian healthcare.
                     Suggest appropriate ICD-10 codes based on the diagnosis and symptoms provided.
                     Provide up to 5 most relevant codes with confidence scores.`
          },
          {
            role: 'user',
            content: `Diagnosis: ${diagnosis}\nSymptoms: ${symptoms?.join(', ') || 'Not specified'}\n\nSuggest appropriate ICD-10 codes.`
          }
        ],
        temperature: 0.2,
        max_tokens: 400
      });

      const content = completion.choices[0]?.message?.content || '';
      const suggestions = this.parseICD10Suggestions(content);
      
      return {
        suggestions,
        tokensUsed: completion.usage?.total_tokens || 0
      };
    } catch (error) {
      logger.error('ICD-10 code suggestion failed', { error });
      return this.getFallbackICD10Suggestions(diagnosis);
    }
  }

  /**
   * Validate claim before submission
   */
  async validateClaim(claimData: any): Promise<any> {
    if (!this.isAvailable) {
      return this.basicValidation(claimData);
    }

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: `You are a medical claims validation expert for Canadian healthcare.
                     Check claims for common errors, missing information, and compliance issues.
                     Consider provincial requirements (OHIP for Ontario, MSP for BC, RAMQ for Quebec).`
          },
          {
            role: 'user',
            content: `Please validate this insurance claim:\n${JSON.stringify(claimData, null, 2)}`
          }
        ],
        functions: [{
          name: 'validateClaim',
          description: 'Validate insurance claim data',
          parameters: {
            type: 'object',
            properties: ValidationResponseSchema.shape,
            required: ['isValid', 'errors', 'warnings']
          }
        }],
        function_call: { name: 'validateClaim' },
        temperature: 0.3,
        max_tokens: 400
      });

      const functionCall = completion.choices[0]?.message?.function_call;
      if (functionCall?.arguments) {
        const validation = JSON.parse(functionCall.arguments);
        
        // Check for pre-authorization requirements
        const preAuthCheck = this.checkPreAuthRequirements(claimData.codes || []);
        if (preAuthCheck.required) {
          validation.warnings = validation.warnings || [];
          validation.warnings.push(preAuthCheck.message);
        }
        
        return {
          ...validation,
          tokensUsed: completion.usage?.total_tokens || 0
        };
      }

      return this.basicValidation(claimData);
    } catch (error) {
      logger.error('Claim validation failed', { error });
      return this.basicValidation(claimData);
    }
  }

  /**
   * Provide smart auto-completion suggestions
   */
  async getAutoCompleteSuggestions(fieldName: string, context: any): Promise<any> {
    if (!this.isAvailable) {
      return this.getBasicSuggestions(fieldName, context);
    }

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: `You are helping complete medical claim forms in Canada.
                     Provide relevant suggestions based on the field and context.`
          },
          {
            role: 'user',
            content: `Field: ${fieldName}\nContext: ${JSON.stringify(context)}\nProvide 3-5 suggestions.`
          }
        ],
        temperature: 0.5,
        max_tokens: 150
      });

      const content = completion.choices[0]?.message?.content || '';
      const suggestions = content.split('\n')
        .filter(s => s.trim())
        .map(s => s.replace(/^\d+\.?\s*/, '').trim())
        .slice(0, 5);

      return {
        suggestions,
        tokensUsed: completion.usage?.total_tokens || 0
      };
    } catch (error) {
      logger.error('Auto-complete suggestion failed', { error });
      return this.getBasicSuggestions(fieldName, context);
    }
  }

  /**
   * Check if procedures require pre-authorization
   */
  private checkPreAuthRequirements(codes: any[]): { required: boolean; message: string } {
    for (const code of codes) {
      const codeStr = code.code || code;
      if (PREAUTH_REQUIRED[codeStr]) {
        const requirement = PREAUTH_REQUIRED[codeStr];
        return {
          required: true,
          message: `Pre-authorization may be required for ${requirement.procedure}: ${requirement.reason}`
        };
      }
    }
    return { required: false, message: '' };
  }

  /**
   * Quick ICD-10 suggestions from common codes
   */
  private getQuickICD10Suggestions(diagnosis: string): any[] {
    const searchTerm = diagnosis.toLowerCase();
    const suggestions = [];
    
    for (const [code, description] of Object.entries(COMMON_ICD10_CODES)) {
      if (description.toLowerCase().includes(searchTerm) || 
          searchTerm.includes(description.toLowerCase().split(',')[0])) {
        suggestions.push({
          code,
          description,
          confidence: 0.8,
          category: 'Common Diagnosis'
        });
      }
    }
    
    return suggestions.slice(0, 5);
  }

  /**
   * Parse ICD-10 suggestions from GPT response
   */
  private parseICD10Suggestions(content: string): any[] {
    const suggestions = [];
    const lines = content.split('\n');
    
    for (const line of lines) {
      const match = line.match(/([A-Z]\d{2}\.?\d*)\s*[-–]\s*(.+)/);
      if (match) {
        suggestions.push({
          code: match[1],
          description: match[2].trim(),
          confidence: 0.7,
          category: 'AI Suggested'
        });
      }
    }
    
    return suggestions.slice(0, 5);
  }

  /**
   * Basic validation without AI
   */
  private basicValidation(claimData: any): any {
    const errors = [];
    const warnings = [];
    const missingFields = [];
    
    // Check required fields
    if (!claimData.patientId) missingFields.push('Patient');
    if (!claimData.providerId) missingFields.push('Provider');
    if (!claimData.insurerId) missingFields.push('Insurer');
    if (!claimData.codes || claimData.codes.length === 0) errors.push('At least one procedure code is required');
    if (!claimData.amount || parseFloat(claimData.amount) <= 0) errors.push('Valid claim amount is required');
    
    // Check for pre-auth requirements
    const preAuthCheck = this.checkPreAuthRequirements(claimData.codes || []);
    if (preAuthCheck.required) {
      warnings.push(preAuthCheck.message);
    }
    
    // Check for common issues
    if (claimData.amount && parseFloat(claimData.amount) > 10000) {
      warnings.push('High claim amount may require additional documentation');
    }
    
    return {
      isValid: errors.length === 0 && missingFields.length === 0,
      errors,
      warnings,
      suggestions: [],
      missingFields,
      tokensUsed: 0
    };
  }

  /**
   * Fallback document analysis when AI is unavailable
   */
  private getFallbackDocumentAnalysis(): any {
    return {
      patientName: null,
      dateOfService: new Date().toISOString().split('T')[0],
      diagnosis: null,
      symptoms: [],
      treatmentPlan: null,
      medicationsPrescribed: [],
      proceduresPerformed: [],
      followUpRequired: false,
      referralNeeded: null,
      tokensUsed: 0,
      fallback: true
    };
  }

  /**
   * Fallback ICD-10 suggestions
   */
  private getFallbackICD10Suggestions(diagnosis: string): any {
    return {
      suggestions: this.getQuickICD10Suggestions(diagnosis),
      tokensUsed: 0,
      fallback: true
    };
  }

  /**
   * Basic suggestions without AI
   */
  private getBasicSuggestions(fieldName: string, context: any): any {
    const suggestions = [];
    
    switch (fieldName.toLowerCase()) {
      case 'diagnosis':
        suggestions.push(
          'Upper respiratory infection',
          'Hypertension',
          'Type 2 diabetes',
          'Lower back pain',
          'Anxiety disorder'
        );
        break;
      case 'procedure':
        suggestions.push(
          'General assessment',
          'Minor assessment',
          'Consultation',
          'Annual health exam',
          'Injection'
        );
        break;
      case 'notes':
        suggestions.push(
          'Patient responded well to treatment',
          'Follow-up recommended in 2 weeks',
          'Referred to specialist',
          'Prescription provided',
          'No complications observed'
        );
        break;
    }
    
    return {
      suggestions: suggestions.slice(0, 5),
      tokensUsed: 0,
      fallback: true
    };
  }
}

// Export singleton instance
export const aiAssistant = new AIClaimsAssistant();