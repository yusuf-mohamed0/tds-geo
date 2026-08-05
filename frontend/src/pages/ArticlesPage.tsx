import { useEffect, useState, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Page, Card, Text, Button, Spinner, Banner,
  IndexTable, Filters, Badge, BlockStack, InlineStack, Pagination, Select,
} from '@shopify/polaris';
import { Languages } from 'lucide-react';
import { apiFetch } from '../api/client';
import { SUPPORTED_LOCALES, getLocaleName } from '../api/locale';
import type { ArticleSummary, PaginatedResponse } from '../types';

const statusOptions = [
  { value: '', label: 'All' },
  { value: 'draft', label: 'Draft' },
  { value: 'generated', label: 'Generated' },
  { value: 'approved', label: 'Approved' },
  { value: 'published', label: 'Published' },
  { value: 'rejected', label: 'Rejected' },
];

export default function ArticlesPage() {
  const [searchParams] = useSearchParams();
  const clientId = searchParams.get('clientId');
  const [data, setData] = useState<PaginatedResponse<ArticleSummary> | null>(null);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState(() => searchParams.get('status') || '');
  const [localeFilter, setLocaleFilter] = useState(() => searchParams.get('locale') || '');
  const [loading, setLoading] = useState(true);
  const [showGenerate, setShowGenerate] = useState(false);
  const [keyword, setKeyword] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');
  const [generateResult, setGenerateResult] = useState('');
  const [queryValue, setQueryValue] = useState('');
  const [pageError, setPageError] = useState('');
  const navigate = useNavigate();
  const limit = 20;

  const handleGenerate = async () => {
    if (!keyword.trim()) return;
    setGenerating(true);
    setGenerateError('');
    setGenerateResult('');
    try {
      const res = await apiFetch<{ success: boolean; article?: Record<string, unknown>; error?: string }>('/api/articles/generate', {
        method: 'POST',
        body: JSON.stringify({ keyword: keyword.trim() }),
      });
      if (res.success) {
        setGenerateResult('Article generated successfully!');
        setKeyword('');
        setTimeout(() => { setShowGenerate(false); setGenerateResult(''); }, 1500);
        fetchArticles();
      } else {
        setGenerateError(res.error || 'Generation failed');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Generation failed. Try a different topic.';
      setGenerateError(msg);
    } finally {
      setGenerating(false);
    }
  };

  const fetchArticles = useCallback(() => {
    setLoading(true);
    setPageError('');
    const params = new URLSearchParams({ limit: String(limit), offset: String((page - 1) * limit) });
    if (clientId) params.set('clientId', clientId);
    if (statusFilter) params.set('status', statusFilter);
    if (localeFilter) params.set('locale', localeFilter);
    apiFetch<PaginatedResponse<ArticleSummary>>(`/api/articles?${params}`)
      .then(setData)
      .catch((err: unknown) => {
        setPageError(err instanceof Error ? err.message : 'Failed to load articles.');
      })
      .finally(() => setLoading(false));
  }, [clientId, page, statusFilter, localeFilter]);

  useEffect(() => { fetchArticles(); }, [fetchArticles]);

  const totalPages = data ? Math.ceil(data.total / limit) : 1;

  const handleStatusFilter = useCallback((value: string) => {
    setStatusFilter(value);
    setPage(1);
  }, []);

  const handleLocaleFilter = useCallback((value: string) => {
    setLocaleFilter(value);
    setPage(1);
  }, []);

  const localeOptions = [
    { value: '', label: 'All languages' },
    ...SUPPORTED_LOCALES.map(l => ({ value: l.code, label: `${l.nativeName} (${l.name})` })),
  ];

  const filters = [
    {
      key: 'status',
      label: 'Status',
      filter: (
        <div style={{ display: 'flex', gap: 'var(--p-space-100)', flexWrap: 'wrap', padding: 'var(--p-space-100)' }}>
          {statusOptions.map((f) => (
            <Button
              key={f.value}
              size="slim"
              variant={statusFilter === f.value ? 'primary' : 'tertiary'}
              onClick={() => handleStatusFilter(f.value)}
            >
              {f.label}
            </Button>
          ))}
        </div>
      ),
      shortcut: true,
    },
    {
      key: 'locale',
      label: 'Language',
      filter: (
        <div style={{ padding: 'var(--p-space-200)', minWidth: 200 }}>
          <Select
            label="Language"
            labelHidden
            value={localeFilter}
            onChange={handleLocaleFilter}
            options={localeOptions}
          />
        </div>
      ),
      shortcut: true,
    },
  ];

  const appliedFilters = [
    ...(statusFilter ? [{ key: 'status', label: `Status: ${statusFilter}`, onRemove: () => handleStatusFilter('') }] : []),
    ...(localeFilter ? [{ key: 'locale', label: `Language: ${getLocaleName(localeFilter)}`, onRemove: () => handleLocaleFilter('') }] : []),
  ];

  const handleFiltersClearAll = useCallback(() => {
    handleStatusFilter('');
    handleLocaleFilter('');
    setQueryValue('');
  }, [handleStatusFilter, handleLocaleFilter]);

  const rowMarkup = (data?.data || []).map((article, index) => (
    <IndexTable.Row
      id={article.id}
      key={article.id}
      position={index}
      onClick={() => navigate(`/admin/articles/${article.id}`)}
    >
      <IndexTable.Cell>
        <Text as="span" variant="bodyMd" fontWeight="medium">{article.title}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Badge tone={
          article.status === 'published' ? 'success' :
          article.status === 'approved' ? 'info' :
          article.status === 'generated' ? 'warning' :
          article.status === 'rejected' ? 'critical' : 'attention'
        }>{article.status}</Badge>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {article.locale ? (
          <InlineStack gap="100" blockAlign="center">
            <Languages size={12} style={{ opacity: 0.5 }} />
            <Badge tone="info">{getLocaleName(article.locale)}</Badge>
          </InlineStack>
        ) : (
          <Text as="span" variant="bodySm" tone="subdued">-</Text>
        )}
      </IndexTable.Cell>
      <IndexTable.Cell>
        {article.scheduled_at ? (
          <Text as="span" variant="bodySm">
            {new Date(article.scheduled_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
          </Text>
        ) : (
          <Text as="span" variant="bodySm" tone="subdued">-</Text>
        )}
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodySm" tone="subdued">{article.word_count || '-'}</Text>
      </IndexTable.Cell>
      <IndexTable.Cell>
        {article.seo_score ? (
          <Text as="span" variant="bodyMd" fontWeight="medium">{article.seo_score}</Text>
        ) : '-'}
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Text as="span" variant="bodySm" tone="subdued">
          {new Date(article.created_at || article.createdAt).toLocaleDateString()}
        </Text>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title="Articles"
      subtitle={data ? `${data.total} article${data.total !== 1 ? 's' : ''} total` : 'Manage your content'}
      primaryAction={{
        content: 'Generate',
        onAction: () => setShowGenerate(true),
      }}
    >
      <BlockStack gap="400">
        {pageError && (
          <Banner tone="critical" title="Could not load articles" onDismiss={() => setPageError('')}>
            <p>{pageError}</p>
            <div style={{ paddingTop: 'var(--p-space-200)' }}>
              <Button onClick={fetchArticles}>Try again</Button>
            </div>
          </Banner>
        )}
        <Card padding="0">
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--p-space-1600)' }}>
              <Spinner accessibilityLabel="Loading articles" size="large" />
            </div>
          ) : data && data.data.length > 0 ? (
            <>
              <Filters
                queryValue={queryValue}
                onQueryChange={setQueryValue}
                onQueryClear={() => setQueryValue('')}
                filters={filters}
                appliedFilters={appliedFilters}
                onClearAll={handleFiltersClearAll}
              />
              <IndexTable
                resourceName={{ singular: 'article', plural: 'articles' }}
                itemCount={data.data.length}
                headings={[
                  { title: 'Title' },
                  { title: 'Status' },
                  { title: 'Language' },
                  { title: 'Schedule' },
                  { title: 'Words' },
                  { title: 'SEO' },
                  { title: 'Created' },
                ]}
                selectable={false}
              >
                {rowMarkup}
              </IndexTable>
            </>
          ) : (
            <div style={{ textAlign: 'center', padding: 'var(--p-space-1600)' }}>
              <Text as="p" variant="bodyMd" tone="subdued">No articles found</Text>
            </div>
          )}
        </Card>

        {data && data.total > limit && (
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <Pagination
              label={`Page ${page} of ${totalPages}`}
              hasPrevious={page > 1}
              onPrevious={() => setPage(page - 1)}
              hasNext={page < totalPages}
              onNext={() => setPage(page + 1)}
            />
          </div>
        )}
      </BlockStack>

      {showGenerate && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' }} onClick={() => setShowGenerate(false)} role="presentation">
          <div style={{ width: '100%', maxWidth: 480, margin: '0 var(--p-space-400)' }} onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Generate article">
            <Card>
              <BlockStack gap="400">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text as="h2" variant="headingMd">Generate Article</Text>
                  <Button variant="tertiary" onClick={() => setShowGenerate(false)} accessibilityLabel="Close" />
                </div>
                <Text as="p" variant="bodyMd" tone="subdued">Enter a topic to generate AI-powered content optimized for your store.</Text>
                <input
                  aria-label="Article topic"
                  className="input"
                  placeholder="e.g. Spring HVAC maintenance tips"
                  value={keyword}
                  onChange={(e) => { setKeyword(e.target.value); setGenerateError(''); setGenerateResult(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && keyword.trim() && handleGenerate()}
                  disabled={generating}
                  autoFocus
                />
                {generateError && <Banner tone="critical">{generateError}</Banner>}
                {generateResult && <Banner tone="success">{generateResult}</Banner>}
                <div style={{ display: 'flex', gap: 'var(--p-space-200)', justifyContent: 'flex-end' }}>
                  <Button variant="tertiary" onClick={() => setShowGenerate(false)} disabled={generating}>Cancel</Button>
                  <Button variant="primary" onClick={handleGenerate} disabled={generating || !keyword.trim()} loading={generating}>
                    Generate
                  </Button>
                </div>
              </BlockStack>
            </Card>
          </div>
        </div>
      )}
    </Page>
  );
}
