import { QueryClient, QueryCache } from '@tanstack/react-query';
import { toast } from 'sonner';
import { NetworkError, UnauthorizedError, ServerError } from '@/lib/api';

export const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error) => {
      if (error instanceof UnauthorizedError) {
        toast.error('세션이 만료되었습니다. 다시 로그인해주세요');
        window.location.replace('/login');
      } else if (error instanceof NetworkError) {
        toast.error('서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요');
      } else if (error instanceof ServerError) {
        toast.error('서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요');
      }
      // ForbiddenError / NotFoundError는 페이지 안에서 인라인 카드로 처리
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,
      refetchOnWindowFocus: false,
    },
  },
});
