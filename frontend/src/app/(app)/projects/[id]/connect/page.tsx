import { createClient } from '@/utils/supabase/server';
import { notFound } from 'next/navigation';
import ConnectClient from './ConnectClient';

export default async function ProjectConnectPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const supabase = await createClient();

  const { data: project } = await supabase.from('projects').select('*').eq('id', params.id).single();

  if (!project) {
    notFound();
  }

  return <ConnectClient project={project} />;
}
