import type { Component } from 'vue'

export interface CodeSnippet {
  title: string
  description: string
  code: string
}

export interface ExampleDefinition {
  id: string
  icon: string
  title: string
  description: string
  tags: string[]
  component: Component
  setupGuide: string
  codeSnippets: CodeSnippet[]
}
