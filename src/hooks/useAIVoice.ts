import { useCallback, useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import Voice from '@react-native-voice/voice';

interface UseAIVoiceOptions {
	apiKey: string;
	model?: string;
	maxTokens?: number;
	system?: string;
	language?: string;
	autoSendOnStop?: boolean;
}

interface UseAIVoiceReturn {
	transcription: string;
	response: string;
	isRecording: boolean;
	isLoading: boolean;
	error: string | null;
	startRecording: () => Promise<void>;
	stopRecording: () => Promise<void>;
	sendTranscription: (overrideText?: string) => Promise<string | null>;
	clearVoiceState: () => void;
}

interface ClaudeTextBlock {
	type?: string;
	text?: string;
}

interface ClaudeApiResult {
	content?: ClaudeTextBlock[];
	error?: {
		message?: string;
	};
}

interface SpeechResultsEvent {
	value?: string[];
}

interface SpeechErrorEvent {
	error?: {
		message?: string;
	};
}

function getClaudeTextContent(data: unknown): string {
	const content = (data as ClaudeApiResult)?.content;
	if (!Array.isArray(content)) {
		return '';
	}

	return content
		.filter(item => item?.type === 'text' && typeof item.text === 'string')
		.map(item => item.text as string)
		.join('\n')
		.trim();
}

/**
 * Handles speech-to-text capture and optional AI response generation from transcribed speech.
 *
 * @param options Voice hook configuration including API key, model settings, recognition
 * language, and whether transcription should be auto-sent after recording stops.
 * @returns Voice interaction state with transcription/response values, recording and loading
 * indicators, error state, and actions to start/stop recording, send transcription, and clear state.
 */
export function useAIVoice(options: UseAIVoiceOptions): UseAIVoiceReturn {
	const [transcription, setTranscription] = useState('');
	const [response, setResponse] = useState('');
	const [isRecording, setIsRecording] = useState(false);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const transcriptionRef = useRef('');
	const isMountedRef = useRef(true);

	const requestMicPermission = useCallback(async () => {
		if (Platform.OS !== 'android') {
			return true;
		}

		const permission = await PermissionsAndroid.request(
			PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
		);
		return permission === PermissionsAndroid.RESULTS.GRANTED;
	}, []);

	const sendTranscription = useCallback(
		async (overrideText?: string) => {
			const prompt = (overrideText ?? transcriptionRef.current).trim();

			if (!prompt) {
				setError('No transcription available to send.');
				return null;
			}

			if (!options.apiKey) {
				setError('Missing Claude API key.');
				return null;
			}

			setIsLoading(true);
			setError(null);

			try {
				const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
					method: 'POST',
					headers: {
						'Content-Type': 'application/json',
						'x-api-key': options.apiKey,
						'anthropic-version': '2023-06-01',
					},
					body: JSON.stringify({
						model: options.model || 'claude-sonnet-4-20250514',
						max_tokens: options.maxTokens ?? 1024,
						system: options.system,
						messages: [{ role: 'user', content: prompt }],
					}),
				});

				const data = (await apiResponse.json()) as ClaudeApiResult;
				if (!apiResponse.ok) {
					throw new Error(data?.error?.message || `Claude API error: ${apiResponse.status}`);
				}

				const text = getClaudeTextContent(data);
				if (!text) {
					throw new Error('No text response returned by Claude API.');
				}

				setResponse(text);
				return text;
			} catch (err) {
				const message = (err as Error).message || 'Failed to send transcription';
				setError(message);
				return null;
			} finally {
				if (isMountedRef.current) {
					setIsLoading(false);
				}
			}
		},
		[options.apiKey, options.maxTokens, options.model, options.system],
	);

	const startRecording = useCallback(async () => {
		setError(null);

		const permissionGranted = await requestMicPermission();
		if (!permissionGranted) {
			setError('Microphone permission not granted.');
			return;
		}

		try {
			transcriptionRef.current = '';
			setTranscription('');
			await Voice.start(options.language || 'en-US');
			setIsRecording(true);
		} catch (err) {
			const message = (err as Error).message || 'Failed to start voice recording';
			setError(message);
			setIsRecording(false);
		}
	}, [options.language, requestMicPermission]);

	const stopRecording = useCallback(async () => {
		try {
			await Voice.stop();
		} catch {
			// Ignore stop failures; state is reset below.
		} finally {
			setIsRecording(false);
		}

		if (options.autoSendOnStop !== false) {
			await sendTranscription();
		}
	}, [options.autoSendOnStop, sendTranscription]);

	const clearVoiceState = useCallback(() => {
		transcriptionRef.current = '';
		setTranscription('');
		setResponse('');
		setError(null);
	}, []);

	useEffect(() => {
		isMountedRef.current = true;

		Voice.onSpeechResults = (event: SpeechResultsEvent) => {
			const latestText = event?.value?.[0]?.trim() || '';
			transcriptionRef.current = latestText;
			setTranscription(latestText);
		};

		Voice.onSpeechError = (event: SpeechErrorEvent) => {
			const message = event?.error?.message || 'Speech recognition failed.';
			setError(message);
			setIsRecording(false);
		};

		Voice.onSpeechEnd = () => {
			setIsRecording(false);
		};

		return () => {
			isMountedRef.current = false;
			Voice.destroy().catch(() => undefined);
			Voice.removeAllListeners();
		};
	}, []);

	return {
		transcription,
		response,
		isRecording,
		isLoading,
		error,
		startRecording,
		stopRecording,
		sendTranscription,
		clearVoiceState,
	};
}
