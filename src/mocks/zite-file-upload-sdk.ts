export const uploadFile = async (input: { data: File, filename?: string }): Promise<{ fileUrl: string }> => {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve({ fileUrl: reader.result as string });
    };
    reader.readAsDataURL(input.data);
  });
};
