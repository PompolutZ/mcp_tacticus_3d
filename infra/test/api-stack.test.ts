import { App } from 'aws-cdk-lib'
import { Match, Template } from 'aws-cdk-lib/assertions'
import { describe, expect, it } from 'vitest'
import { ApiStack } from '../lib/api-stack'

function synth(reservedConcurrency: number | null) {
  // No bundling stacks: the tests do not run esbuild. The synth check does.
  const app = new App({ context: { 'aws:cdk:bundling-stacks': [] } })
  const stack = new ApiStack(app, 'Api', {
    env: { account: '111111111111', region: 'eu-central-1' },
    version: 'abc1234',
    reservedConcurrency,
  })
  return Template.fromStack(stack)
}

describe('ApiStack', () => {
  const t = synth(10)

  it('defines the function', () => {
    t.hasResourceProperties('AWS::Lambda::Function', {
      FunctionName: 'mcptacticus-api',
      Runtime: 'nodejs24.x',
      Architectures: ['arm64'],
      MemorySize: 256,
      Timeout: 10,
    })
  })

  it('has exactly the four env vars', () => {
    t.hasResourceProperties('AWS::Lambda::Function', {
      Environment: {
        Variables: {
          SSM_PREFIX: '/mcptacticus/prod/',
          DB_NAME: 'assist3d',
          APP_VERSION: 'abc1234',
          NODE_OPTIONS: '--enable-source-maps',
        },
      },
    })
  })

  it('has a function URL with the CORS of the design', () => {
    t.hasResourceProperties('AWS::Lambda::Url', {
      AuthType: 'NONE',
      Cors: {
        AllowOrigins: ['https://mcptacticus3d.netlify.app'],
        AllowHeaders: ['authorization', 'content-type', 'x-after'],
        AllowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        MaxAge: 86400,
      },
    })
  })

  it('has both invoke permissions of the function URL', () => {
    t.hasResourceProperties('AWS::Lambda::Permission', {
      Action: 'lambda:InvokeFunctionUrl',
      Principal: '*',
      FunctionUrlAuthType: 'NONE',
    })
    t.hasResourceProperties('AWS::Lambda::Permission', {
      Action: 'lambda:InvokeFunction',
      Principal: '*',
      InvokedViaFunctionUrl: true,
    })
  })

  it('keeps logs for one week', () => {
    t.hasResourceProperties('AWS::Logs::LogGroup', {
      LogGroupName: '/aws/lambda/mcptacticus-api',
      RetentionInDays: 7,
    })
  })

  it('has a daily keep-alive rule', () => {
    t.hasResourceProperties('AWS::Events::Rule', {
      ScheduleExpression: 'rate(1 day)',
      Targets: [Match.objectLike({ Input: '{"keepAlive":true}' })],
    })
  })

  it('reads SSM parameters under the prefix', () => {
    const arn = (name: string) => ({
      'Fn::Join': [
        '',
        ['arn:', { Ref: 'AWS::Partition' }, `:ssm:eu-central-1:111111111111:${name}`],
      ],
    })
    t.hasResourceProperties('AWS::IAM::Policy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          {
            Action: 'ssm:GetParametersByPath',
            Effect: 'Allow',
            Resource: [arn('parameter/mcptacticus/prod'), arn('parameter/mcptacticus/prod/*')],
          },
        ]),
      },
    })
  })

  it('sets reserved concurrency only with a number', () => {
    t.hasResourceProperties('AWS::Lambda::Function', { ReservedConcurrentExecutions: 10 })
    const none = synth(null)
    const fns = none.findResources('AWS::Lambda::Function', {
      FunctionName: 'mcptacticus-api',
    })
    for (const fn of Object.values(fns)) {
      expect(fn.Properties).not.toHaveProperty('ReservedConcurrentExecutions')
    }
  })

  it('outputs ApiUrl', () => {
    expect(t.toJSON().Outputs).toHaveProperty('ApiUrl')
  })
})
