import { FetchFunction } from '@ai-sdk/provider-utils';
import type {
  Attachment,
  ChatRequest,
  ChatRequestOptions,
  CreateMessage,
  IdGenerator,
  JSONValue,
  Message,
  UseChatOptions,
} from '@ai-sdk/ui-utils';
import { callChatApi, generateId as generateIdFunc } from '@ai-sdk/ui-utils';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import useSWR, { KeyedMutator } from 'swr';

export type { CreateMessage, Message, UseChatOptions };

export type UseChatHelpers = {
  messages: Message[];
  error: undefined | Error;
  append: (
    message: Message | CreateMessage,
    chatRequestOptions?: ChatRequestOptions,
  ) => Promise<string | null | undefined>;
  reload: (
    chatRequestOptions?: ChatRequestOptions,
  ) => Promise<string | null | undefined>;
  stop: () => void;
  setMessages: (
    messages: Message[] | ((messages: Message[]) => Message[]),
  ) => void;
  input: string;
  setInput: React.Dispatch<React.SetStateAction<string>>;
  handleInputChange: (
    e:
      | React.ChangeEvent<HTMLInputElement>
      | React.ChangeEvent<HTMLTextAreaElement>,
  ) => void;
  handleSubmit: (
    event?: { preventDefault?: () => void },
    chatRequestOptions?: ChatRequestOptions,
  ) => void;
  metadata?: Object;
  isLoading: boolean;
  data?: JSONValue[];
  setData: (
    data:
      | JSONValue[]
      | undefined
      | ((data: JSONValue[] | undefined) => JSONValue[] | undefined),
  ) => void;
};

const processResponseStream = async (
  api: string,
  chatRequest: ChatRequest,
  mutate: KeyedMutator<Message[]>,
  mutateStreamData: KeyedMutator<JSONValue[] | undefined>,
  existingDataRef: React.MutableRefObject<JSONValue[] | undefined>,
  extraMetadataRef: React.MutableRefObject<any>,
  messagesRef: React.MutableRefObject<Message[]>,
  abortControllerRef: React.MutableRefObject<AbortController | null>,
  generateId: IdGenerator,
  streamProtocol: UseChatOptions['streamProtocol'],
  onFinish: UseChatOptions['onFinish'],
  onResponse: ((response: Response) => void | Promise<void>) | undefined,
  onToolCall: UseChatOptions['onToolCall'] | undefined,
  sendExtraMessageFields: boolean | undefined,
  experimental_prepareRequestBody:
    | ((options: {
        messages: Message[];
        requestData?: JSONValue;
        requestBody?: object;
      }) => JSONValue)
    | undefined,
  fetch: FetchFunction | undefined,
  keepLastMessageOnError: boolean,
) => {
  const previousMessages = messagesRef.current;
  mutate(chatRequest.messages, false);

  const constructedMessagesPayload = sendExtraMessageFields
    ? chatRequest.messages
    : chatRequest.messages.map(({ role, content, experimental_attachments, data, annotations }) => ({
        role,
        content,
        ...(experimental_attachments !== undefined && { experimental_attachments }),
        ...(data !== undefined && { data }),
        ...(annotations !== undefined && { annotations }),
      }));

  const existingData = existingDataRef.current;

  return await callChatApi({
    api,
    body: experimental_prepareRequestBody?.({
      messages: chatRequest.messages,
      requestData: chatRequest.data,
      requestBody: chatRequest.body,
    }) ?? {
      messages: constructedMessagesPayload,
      data: chatRequest.data,
      ...extraMetadataRef.current.body,
      ...chatRequest.body,
    },
    streamProtocol,
    credentials: extraMetadataRef.current.credentials,
    headers: {
      ...extraMetadataRef.current.headers,
      ...chatRequest.headers,
    },
    abortController: () => abortControllerRef.current,
    restoreMessagesOnFailure() {
      if (!keepLastMessageOnError) {
        mutate(previousMessages, false);
      }
    },
    onResponse,
    onUpdate(merged, data) {
      mutate([...chatRequest.messages, ...merged], false);
      if (data?.length) {
        mutateStreamData([...(existingData ?? []), ...data], false);
      }
    },
    onToolCall,
    onFinish,
    generateId,
    fetch,
  });
};

export function useChat({
  api = '/api/chat',
  id,
  initialMessages,
  initialInput = '',
  sendExtraMessageFields,
  onToolCall,
  experimental_prepareRequestBody,
  maxSteps = 1,
  streamProtocol = 'data',
  onResponse,
  onFinish,
  onError,
  credentials,
  headers,
  body,
  generateId = generateIdFunc,
  fetch,
  keepLastMessageOnError = true,
}: UseChatOptions & {
  key?: string;
  experimental_prepareRequestBody?: (options: {
    messages: Message[];
    requestData?: JSONValue;
    requestBody?: object;
  }) => JSONValue;
  maxSteps?: number;
} = {}): UseChatHelpers & {
  addToolResult: ({
    toolCallId,
    result,
  }: {
    toolCallId: string;
    result: any;
  }) => void;
} {
  const hookId = useId();
  const idKey = id ?? hookId;
  const chatKey = typeof api === 'string' ? [api, idKey] : idKey;

  const [initialMessagesFallback] = useState([]);

  const { data: messages, mutate } = useSWR<Message[]>(
    [chatKey, 'messages'],
    null,
    { fallbackData: initialMessages ?? initialMessagesFallback },
  );

  const messagesRef = useRef<Message[]>(messages || []);
  useEffect(() => {
    messagesRef.current = messages || [];
  }, [messages]);

  const { data: streamData, mutate: mutateStreamData } = useSWR<
    JSONValue[] | undefined
  >([chatKey, 'streamData'], null);

  const streamDataRef = useRef<JSONValue[] | undefined>(streamData);
  useEffect(() => {
    streamDataRef.current = streamData;
  }, [streamData]);

  const { data: isLoading = false, mutate: mutateLoading } = useSWR<boolean>(
    [chatKey, 'loading'],
    null,
  );

  const { data: error = undefined, mutate: setError } = useSWR<
    undefined | Error
  >([chatKey, 'error'], null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const extraMetadataRef = useRef({
    credentials,
    headers,
    body,
  });

  useEffect(() => {
    extraMetadataRef.current = {
      credentials,
      headers,
      body,
    };
  }, [credentials, headers, body]);

  const triggerRequest = useCallback(
    async (chatRequest: ChatRequest) => {
      const messageCount = messagesRef.current.length;

      try {
        mutateLoading(true);
        setError(undefined);

        const abortController = new AbortController();
        abortControllerRef.current = abortController;

        await processResponseStream(
          api,
          chatRequest,
          mutate,
          mutateStreamData,
          streamDataRef,
          extraMetadataRef,
          messagesRef,
          abortControllerRef,
          generateId,
          streamProtocol,
          onFinish,
          onResponse,
          onToolCall,
          sendExtraMessageFields,
          experimental_prepareRequestBody,
          fetch,
          keepLastMessageOnError,
        );

        abortControllerRef.current = null;
      } catch (err) {
        if ((err as any).name === 'AbortError') {
          abortControllerRef.current = null;
          return null;
        }

        if (onError && err instanceof Error) {
          onError(err);
        }

        setError(err as Error);
      } finally {
        mutateLoading(false);
      }

      const messages = messagesRef.current;
      const lastMessage = messages[messages.length - 1];
      if (
        messages.length > messageCount &&
        lastMessage != null &&
        maxSteps > 1 &&
        isAssistantMessageWithCompletedToolCalls(lastMessage) &&
        countTrailingAssistantMessages(messages) < maxSteps
      ) {
        await triggerRequest({ messages });
      }
    },
    [
      api,
      mutate,
      mutateLoading,
      mutateStreamData,
      onFinish,
      onResponse,
      onError,
      onToolCall,
      setError,
      streamDataRef,
      maxSteps,
      streamProtocol,
      sendExtraMessageFields,
      experimental_prepareRequestBody,
      fetch,
      generateId,
      keepLastMessageOnError,
    ],
  );

  const append = useCallback(
    async (
      message: Message | CreateMessage,
      {
        data,
        headers,
        body,
        experimental_attachments,
      }: ChatRequestOptions = {},
    ) => {
      if (!message.id) {
        message.id = generateId();
      }

      const attachmentsForRequest = await prepareAttachmentsForRequest(
        experimental_attachments,
      );

      const messages = messagesRef.current.concat({
        ...message,
        id: message.id ?? generateId(),
        createdAt: message.createdAt ?? new Date(),
        experimental_attachments:
          attachmentsForRequest.length > 0 ? attachmentsForRequest : undefined,
      });

      return triggerRequest({ messages, headers, body, data });
    },
    [triggerRequest, generateId],
  );

  const reload = useCallback(
    async ({ data, headers, body }: ChatRequestOptions = {}) => {
      const messages = messagesRef.current;

      if (messages.length === 0) {
        return null;
      }

      const lastMessage = messages[messages.length - 1];
      return triggerRequest({
        messages:
          lastMessage.role === 'assistant' ? messages.slice(0, -1) : messages,
        headers,
        body,
        data,
      });
    },
    [triggerRequest],
  );

  const stop = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  const setMessages = useCallback(
    (messages: Message[] | ((messages: Message[]) => Message[])) => {
      if (typeof messages === 'function') {
        messages = messages(messagesRef.current);
      }

      mutate(messages, false);
      messagesRef.current = messages;
    },
    [mutate],
  );

  const setData = useCallback(
    (
      data:
        | JSONValue[]
        | undefined
        | ((data: JSONValue[] | undefined) => JSONValue[] | undefined),
    ) => {
      if (typeof data === 'function') {
        data = data(streamDataRef.current);
      }

      mutateStreamData(data, false);
      streamDataRef.current = data;
    },
    [mutateStreamData],
  );

  const [input, setInput] = useState(initialInput);

  const handleSubmit = useCallback(
    async (
      event?: { preventDefault?: () => void },
      options: ChatRequestOptions = {},
      metadata?: Object,
    ) => {
      event?.preventDefault?.();

      if (!input && !options.allowEmptySubmit) return;

      if (metadata) {
        extraMetadataRef.current = {
          ...extraMetadataRef.current,
          ...metadata,
        };
      }

      const attachmentsForRequest = await prepareAttachmentsForRequest(
        options.experimental_attachments,
      );

      const messages =
        !input && !attachmentsForRequest.length && options.allowEmptySubmit
          ? messagesRef.current
          : messagesRef.current.concat({
              id: generateId(),
              createdAt: new Date(),
              role: 'user',
              content: input,
              experimental_attachments:
                attachmentsForRequest.length > 0
                  ? attachmentsForRequest
                  : undefined,
            });

      const chatRequest: ChatRequest = {
        messages,
        headers: options.headers,
        body: options.body,
        data: options.data,
      };

      triggerRequest(chatRequest);

      setInput('');
    },
    [input, generateId, triggerRequest],
  );

  const handleInputChange = (e: any) => {
    setInput(e.target.value);
  };

  const addToolResult = ({
    toolCallId,
    result,
  }: {
    toolCallId: string;
    result: any;
  }) => {
    const updatedMessages = messagesRef.current.map((message, index, arr) =>
      index === arr.length - 1 &&
      message.role === 'assistant' &&
      message.toolInvocations
        ? {
            ...message,
            toolInvocations: message.toolInvocations.map(toolInvocation =>
              toolInvocation.toolCallId === toolCallId
                ? {
                    ...toolInvocation,
                    result,
                    state: 'result' as const,
                  }
                : toolInvocation,
            ),
          }
        : message,
    );

    mutate(updatedMessages, false);

    const lastMessage = updatedMessages[updatedMessages.length - 1];
    if (isAssistantMessageWithCompletedToolCalls(lastMessage)) {
      triggerRequest({ messages: updatedMessages });
    }
  };

  return {
    messages: messages || [],
    setMessages,
    data: streamData,
    setData,
    error,
    append,
    reload,
    stop,
    input,
    setInput,
    handleInputChange,
    handleSubmit,
    isLoading,
    addToolResult,
  };
}

function isAssistantMessageWithCompletedToolCalls(message: Message) {
  return (
    message.role === 'assistant' &&
    message.toolInvocations &&
    message.toolInvocations.length > 0 &&
    message.toolInvocations.every(toolInvocation => 'result' in toolInvocation)
  );
}

function countTrailingAssistantMessages(messages: Message[]) {
  let count = 0;
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'assistant') {
      count++;
    } else {
      break;
    }
  }
  return count;
}

async function prepareAttachmentsForRequest(
  attachmentsFromOptions: FileList | Array<Attachment> | undefined,
) {
  if (attachmentsFromOptions == null) {
    return [];
  }

  if (attachmentsFromOptions instanceof FileList) {
    return Promise.all(
      Array.from(attachmentsFromOptions).map(async attachment => {
        const { name, type } = attachment;

        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = readerEvent => {
            resolve(readerEvent.target?.result as string);
          };
          reader.onerror = error => reject(error);
          reader.readAsDataURL(attachment);
        });

        return {
          name,
          contentType: type,
          url: dataUrl,
        };
      }),
    );
  }

  if (Array.isArray(attachmentsFromOptions)) {
    return attachmentsFromOptions;
  }

  throw new Error('Invalid attachments type');
}
