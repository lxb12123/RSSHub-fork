import { config } from '@/config';
import InvalidParameterError from '@/errors/types/invalid-parameter';
import type { Route } from '@/types';
import cache from '@/utils/cache';
import logger from '@/utils/logger';
import { parseDate } from '@/utils/parse-date';
import puppeteer from '@/utils/puppeteer';
import { fallback, queryToBoolean } from '@/utils/readable-social';

import type { PostData } from './types';
import { getOriginAvatar, proxyVideo, resolveUrl, templates } from './utils';

export const route: Route = {
    path: '/user/:uid/:routeParams?',
    categories: ['social-media'],
    example: '/douyin/user/MS4wLjABAAAARcAHmmF9mAG3JEixq_CdP72APhBlGlLVbN-1eBcPqao',
    parameters: { uid: 'uid，可在用户页面 URL 中找到', routeParams: '额外参数，query string 格式，请参阅上面的表格' },
    features: {
        requireConfig: false,
        requirePuppeteer: true,
        antiCrawler: true,
        supportBT: false,
        supportPodcast: false,
        supportScihub: false,
    },
    radar: [
        {
            source: ['douyin.com/user/:uid'],
            target: '/user/:uid',
        },
    ],
    name: '博主',
    maintainers: ['Max-Tortoise', 'Rongronggg9'],
    handler,
};

async function handler(ctx) {
    const uid = ctx.req.param('uid');
    if (!uid.startsWith('MS4wLjABAAAA')) {
        throw new InvalidParameterError('Invalid UID. UID should start with <b>MS4wLjABAAAA</b>.');
    }
    const routeParams = Object.fromEntries(new URLSearchParams(ctx.req.param('routeParams')));
    const embed = fallback(undefined, queryToBoolean(routeParams.embed), false); // embed video
    const iframe = fallback(undefined, queryToBoolean(routeParams.iframe), false); // embed video in iframe
    const relay = resolveUrl(routeParams.relay, true, true); // embed video behind a reverse proxy

    // Cookie 支持：URL 参数 > 环境变量，支持逗号分隔的多 Cookie 轮换
    const cookieSource = routeParams.cookie || config.douyin?.cookie || '';
    const cookieList = cookieSource.split(',').filter((c) => c.trim());
    const cookie = cookieList[Math.floor(Math.random() * cookieList.length)]?.trim() || '';
    if (cookieList.length > 1) {
        logger.http(`[抖音] Cookie 轮换: 使用第 ${cookieList.indexOf(cookie) + 1}/${cookieList.length} 个`);
    }

    const pageUrl = `https://www.douyin.com/user/${uid}`;

    const pageData = (await cache.tryGet(
        `douyin:user:${uid}`,
        async () => {
            const allAwemeList: any[] = [];
            let hasMore = true;
            const browser = await puppeteer();
            const page = await browser.newPage();
            await page.setRequestInterception(true);

            // 设置 Cookie
            if (cookie) {
                const cookies = cookie.split(';').map((c) => {
                    const [name, ...rest] = c.trim().split('=');
                    return {
                        name,
                        value: rest.join('='),
                        domain: '.douyin.com',
                    };
                });
                await page.setCookie(...cookies);
                logger.http(`[抖音] 已设置 ${cookies.length} 个 Cookie`);
            }

            page.on('request', (request) => {
                request.resourceType() === 'document' || request.resourceType() === 'script' || request.resourceType() === 'xhr' ? request.continue() : request.abort();
            });
            page.on('response', async (response) => {
                const request = response.request();
                if (request.url().includes('/web/aweme/post')) {
                    try {
                        const data = await response.json();
                        if (data.aweme_list && data.aweme_list.length > 0) {
                            allAwemeList.push(...data.aweme_list);
                            hasMore = data.has_more === 1;
                            logger.http(`[抖音] 捕获 ${data.aweme_list.length} 个视频, has_more: ${hasMore}, 总计: ${allAwemeList.length}`);
                        }
                    } catch (e) {
                        logger.error(`[抖音] 解析响应失败: ${e}`);
                    }
                }
            });

            logger.http(`Requesting ${pageUrl}`);
            await page.goto(pageUrl, {
                waitUntil: 'networkidle2',
            });

            // 滚动加载更多视频
            let scrollCount = 0;
            const maxScrolls = 5; // 最多滚动 5 次
            while (hasMore && scrollCount < maxScrolls) {
                await page.evaluate(() => {
                    window.scrollBy(0, 1000);
                });
                await new Promise((r) => setTimeout(r, 1500));
                scrollCount++;
                logger.http(`[抖音] 滚动 ${scrollCount}/${maxScrolls}`);
            }

            await browser.close();

            if (allAwemeList.length === 0) {
                throw new Error('Empty post data. The request may be filtered by WAF.');
            }

            // 去重
            const seen = new Set();
            const uniqueList = allAwemeList.filter((item) => {
                if (seen.has(item.aweme_id)) {
                    return false;
                }
                seen.add(item.aweme_id);
                return true;
            });

            logger.http(`[抖音] 总计获取 ${uniqueList.length} 个唯一视频`);

            return { aweme_list: uniqueList };
        },
        config.cache.routeExpire,
        false
    )) as PostData;

    if (!pageData.aweme_list?.length) {
        throw new Error('Empty post data. The request may be filtered by WAF.');
    }
    const userInfo = pageData.aweme_list[0].author;
    const userNickName = userInfo.nickname;
    // const userDescription = userInfo.desc;
    const userAvatar = getOriginAvatar(userInfo.avatar_thumb.url_list.at(-1));

    const items = pageData.aweme_list.map((post) => {
        // parse video
        let videoList = post.video?.bit_rate?.map((item) => resolveUrl(item.play_addr.url_list.at(-1)));
        if (relay) {
            videoList = videoList.map((item) => proxyVideo(item, relay));
        }
        let duration = post.video?.duration;
        duration = duration && duration / 1000;
        let img;
        // if (!embed) {
        //     img = post.video && post.video.dynamicCover; // dynamic cover (webp)
        // }
        img =
            img ||
            post.video?.cover?.url_list.at(-1) || // HD
            post.video?.origin_cover?.url_list.at(-1); // LD
        img = img && resolveUrl(img);

        // render description
        const desc = post.desc?.replaceAll('\n', '<br>');
        let media = (embed && videoList ? templates.embed : templates.cover)({ img, videoList, duration });
        media = embed && videoList && iframe ? templates.iframe({ content: media }) : media; // warp in iframe
        const description = templates.desc({ desc, media });

        return {
            title: post.desc.split('\n')[0],
            description,
            link: `https://www.douyin.com/video/${post.aweme_id}`,
            pubDate: parseDate(post.create_time * 1000),
            category: post.video_tag.map((t) => t.tag_name),
        };
    });

    return {
        title: userNickName,
        // description: userDescription,
        image: userAvatar,
        link: pageUrl,
        item: items,
    };
}
