import express, { Request, Response } from 'express';
import cors from 'cors';
import { streamText } from 'ai';
import { openai } from '@ai-sdk/openai';

export const setupAgent = () => {
  const app = express();
  
  app.use(cors());
  app.use(express.json());
  
  const PORT = process.env.PORT || 3000;

  app.post('/chat', async (req: Request, res: Response) => {
    const { messages } = req.body;

    const result = await streamText({
      model: openai('gpt-4-turbo'),
      messages
    });

    return result.pipeDataStreamToResponse(res);
  });

  app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
  });
};
